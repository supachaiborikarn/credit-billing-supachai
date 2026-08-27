/**
 * UI Components - shared primitives for legacy and redesign screens.
 */

export { Button, buttonVariants, type ButtonProps } from './button';
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './card';
export {
    Input,
    Label,
    FieldMessage,
    type InputProps,
    type LabelProps,
    type FieldMessageProps,
} from './input';
export { Badge, badgeVariants, type BadgeProps } from './badge';
export { Section, type SectionProps } from './section';
export { EmptyState, type EmptyStateProps } from './empty-state';
export { Notice, type NoticeProps, type NoticeTone } from './notice';
export {
    LoadingState,
    AsyncRefreshState,
    FatalErrorState,
    type LoadingStateProps,
    type AsyncRefreshStateProps,
    type FatalErrorStateProps,
} from './async-state';
export {
    Table,
    TableHeader,
    TableBody,
    TableFooter,
    TableHead,
    TableRow,
    TableCell,
    TableCaption,
} from './table';
export {
    ResponsiveDataView,
    MobileDataList,
    MobileDataRow,
    RowAction,
    type ResponsiveDataViewProps,
    type MobileDataRowProps,
    type RowActionProps,
} from './responsive-data-view';
export { Dialog, ConfirmDialog, type DialogProps, type ConfirmDialogProps } from './dialog';
