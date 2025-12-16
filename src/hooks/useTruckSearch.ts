'use client';

import { useState, useEffect, useRef } from 'react';
import { TruckSearchResult } from '@/types';

interface UseTruckSearchOptions {
    minLength?: number;
    debounceMs?: number;
}

/**
 * Custom hook for truck/license plate search with debouncing
 */
export function useTruckSearch(
    searchTerm: string,
    options: UseTruckSearchOptions = {}
) {
    const { minLength = 2, debounceMs = 300 } = options;

    const [results, setResults] = useState<TruckSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Search effect with debounce
    useEffect(() => {
        if (searchTerm.length < minLength) {
            setResults([]);
            setShowDropdown(false);
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/trucks/search?q=${encodeURIComponent(searchTerm)}`);
                if (res.ok) {
                    const data = await res.json();
                    setResults(data);
                    setShowDropdown(data.length > 0);
                }
            } catch (error) {
                console.error('Truck search error:', error);
            } finally {
                setLoading(false);
            }
        }, debounceMs);

        return () => clearTimeout(timer);
    }, [searchTerm, minLength, debounceMs]);

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const closeDropdown = () => setShowDropdown(false);
    const openDropdown = () => {
        if (results.length > 0) setShowDropdown(true);
    };

    return {
        results,
        loading,
        showDropdown,
        dropdownRef,
        closeDropdown,
        openDropdown,
    };
}
