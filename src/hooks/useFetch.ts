// Custom Hooks for data fetching
// Reduces boilerplate and provides consistent loading/error handling

import { useState, useEffect, useCallback } from 'react';

interface UseFetchState<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
}

interface UseFetchOptions {
    immediate?: boolean; // Fetch immediately on mount (default: true)
}

/**
 * Custom hook for data fetching with loading and error states
 * @param url - The URL to fetch from
 * @param options - Fetch options
 * @returns { data, loading, error, refetch }
 */
export function useFetch<T>(
    url: string | null,
    options: UseFetchOptions = { immediate: true }
): UseFetchState<T> & { refetch: () => Promise<void> } {
    const [state, setState] = useState<UseFetchState<T>>({
        data: null,
        loading: options.immediate !== false,
        error: null,
    });

    const fetchData = useCallback(async () => {
        if (!url) {
            setState({ data: null, loading: false, error: null });
            return;
        }

        setState(prev => ({ ...prev, loading: true, error: null }));

        try {
            const res = await fetch(url);

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            const data = await res.json();
            setState({ data, loading: false, error: null });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setState({ data: null, loading: false, error: message });
        }
    }, [url]);

    useEffect(() => {
        if (options.immediate !== false) {
            fetchData();
        }
    }, [fetchData, options.immediate]);

    return { ...state, refetch: fetchData };
}

interface UseSearchOptions<T> {
    minLength?: number;
    debounceMs?: number;
    transform?: (data: unknown) => T[];
}

/**
 * Custom hook for debounced search
 * @param endpoint - Base search endpoint
 * @param query - Search query
 * @param options - Search options
 */
export function useSearch<T>(
    endpoint: string,
    query: string,
    options: UseSearchOptions<T> = {}
): { results: T[]; loading: boolean; showDropdown: boolean } {
    const { minLength = 2, debounceMs = 300, transform } = options;

    const [results, setResults] = useState<T[]>([]);
    const [loading, setLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    useEffect(() => {
        if (query.length < minLength) {
            setResults([]);
            setShowDropdown(false);
            return;
        }

        setLoading(true);
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`${endpoint}?q=${encodeURIComponent(query)}`);
                if (res.ok) {
                    const data = await res.json();
                    const transformedData = transform ? transform(data) : data;
                    setResults(transformedData);
                    setShowDropdown(true);
                }
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setLoading(false);
            }
        }, debounceMs);

        return () => clearTimeout(timer);
    }, [endpoint, query, minLength, debounceMs, transform]);

    return { results, loading, showDropdown };
}

/**
 * Custom hook for POST/PUT/DELETE mutations
 */
export function useMutation<TBody, TResponse = unknown>() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const mutate = useCallback(async (
        url: string,
        method: 'POST' | 'PUT' | 'DELETE',
        body?: TBody
    ): Promise<TResponse | null> => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : undefined,
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${res.status}`);
            }

            const data = await res.json();
            return data as TResponse;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(message);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    return { mutate, loading, error };
}
