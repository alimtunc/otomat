/**
 * Public surface of `@otomat/ui`: the `cn` class merger, the theme system
 * (`ThemeProvider`/`useTheme`), domain status→visual mappings (`resolveStatus`
 * and friends), shell types, and the primitive + composed component library.
 * Import from this barrel rather than reaching into `./primitives`, `./components`,
 * or `./lib` directly.
 *
 * @packageDocumentation
 */
export { cn } from "./lib/utils";

export {
  ThemeProvider,
  useTheme,
  type Density,
  type Direction,
  type Theme,
  type ThemeContextValue,
  type ThemeProviderProps,
  type ThemeState,
} from "./lib/theme";

export { type BreadcrumbItem, type ConnectionState, type ProjectSummary } from "./types/shell";

export type {
  AgentSessionState,
  EventSource,
  EventType,
  IssueSource,
  IssueState,
  PullRequestState,
  ReviewState,
  RunState,
  StepRunState,
} from "@otomat/domain/types";

export {
  EVENT_GLYPH,
  PROVENANCE_LABEL,
  PROVENANCE_VAR,
  resolveStatus,
  SOURCE_BADGE,
  TONE_CHIP_CLASS,
  type EventGlyphDescriptor,
  type StatusDescriptor,
  type StatusKind,
  type StatusTone,
} from "./lib/status";

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
  type AlertDialogContentProps,
  type AlertDialogDescriptionProps,
  type AlertDialogOverlayProps,
  type AlertDialogSectionProps,
  type AlertDialogTitleProps,
} from "./primitives/alert-dialog";

export { Badge, type BadgeProps } from "./primitives/badge";

export { Button, type ButtonProps } from "./primitives/button";

export { Checkbox, type CheckboxProps } from "./primitives/checkbox";

export {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  type CollapsibleContentProps,
  type CollapsibleProps,
  type CollapsibleTriggerProps,
} from "./primitives/collapsible";

export {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandItemId,
  CommandItemRight,
  CommandList,
  CommandSeparator,
  type CommandEmptyProps,
  type CommandGroupProps,
  type CommandInputProps,
  type CommandItemIdProps,
  type CommandItemProps,
  type CommandItemRightProps,
  type CommandListProps,
  type CommandProps,
  type CommandSeparatorProps,
} from "./primitives/command";

export {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuPortal,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  type ContextMenuCheckboxItemProps,
  type ContextMenuContentProps,
  type ContextMenuItemProps,
  type ContextMenuLabelProps,
  type ContextMenuRadioItemProps,
  type ContextMenuSeparatorProps,
  type ContextMenuShortcutProps,
  type ContextMenuSubContentProps,
  type ContextMenuSubTriggerProps,
} from "./primitives/context-menu";

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  type DialogContentProps,
  type DialogDescriptionProps,
  type DialogOverlayProps,
  type DialogSectionProps,
  type DialogTitleProps,
} from "./primitives/dialog";

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  type DropdownMenuCheckboxItemProps,
  type DropdownMenuContentProps,
  type DropdownMenuItemProps,
  type DropdownMenuLabelProps,
  type DropdownMenuRadioItemProps,
  type DropdownMenuSeparatorProps,
  type DropdownMenuShortcutProps,
  type DropdownMenuSubContentProps,
  type DropdownMenuSubTriggerProps,
} from "./primitives/dropdown-menu";

export { Input, type InputProps } from "./primitives/input";

export {
  Popover,
  PopoverAnchor,
  PopoverClose,
  PopoverContent,
  PopoverPortal,
  PopoverTrigger,
  type PopoverContentProps,
} from "./primitives/popover";

export {
  ScrollArea,
  ScrollBar,
  type ScrollAreaProps,
  type ScrollBarProps,
} from "./primitives/scroll-area";

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  type SelectContentProps,
  type SelectItemProps,
  type SelectLabelProps,
  type SelectSeparatorProps,
  type SelectTriggerProps,
} from "./primitives/select";

export { Separator, type SeparatorProps } from "./primitives/separator";

export {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
  type SheetContentProps,
  type SheetDescriptionProps,
  type SheetOverlayProps,
  type SheetSectionProps,
  type SheetTitleProps,
} from "./primitives/sheet";

export { Skeleton, type SkeletonProps } from "./primitives/skeleton";

export { Switch, type SwitchProps } from "./primitives/switch";

export {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type TabsContentProps,
  type TabsListProps,
  type TabsProps,
  type TabsTriggerProps,
} from "./primitives/tabs";

export { Textarea, type TextareaProps } from "./primitives/textarea";

export {
  Tooltip,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipTrigger,
  type TooltipContentProps,
} from "./primitives/tooltip";

export { AgentAvatar, type AgentAvatarProps } from "./components/agent-avatar";

export { AppShell, type AppShellProps } from "./components/app-shell";

export {
  AppSidebar,
  SidebarDaemonStatus,
  type AppSidebarProps,
  type SidebarDaemonStatusProps,
} from "./components/app-sidebar";

export { Avatar, type AvatarProps, type AvatarShape, type AvatarSize } from "./components/avatar";

export { Breadcrumbs, type BreadcrumbsProps } from "./components/breadcrumbs";

export { Chip, type ChipProps, type ChipSize } from "./components/chip";

export {
  CommandPalette,
  useCommandPalette,
  type CommandPaletteCommand,
  type CommandPaletteGroup,
  type CommandPaletteProps,
  type UseCommandPaletteOptions,
  type UseCommandPaletteReturn,
} from "./components/command-palette";

export {
  ConnectionStatusIndicator,
  type ConnectionStatusIndicatorProps,
} from "./components/connection-status-indicator";

export { CopyButton, type CopyButtonProps } from "./components/copy-button";

export {
  EmptyState,
  type EmptyStateProps,
  type EmptyStateTone,
  type EmptyStateVariant,
} from "./components/empty-state";

export { ErrorState, type ErrorStateProps } from "./components/error-state";

export {
  Field,
  FieldControl,
  FieldLabel,
  type FieldControlProps,
  type FieldLabelProps,
  type FieldProps,
} from "./components/field";

export { Icon, type IconName, type IconProps, type IconSize } from "./components/icon";

export { IconButton, type IconButtonProps } from "./components/icon-button";

export { Kbd, type KbdProps } from "./components/kbd";

export { LiveDot, type LiveDotProps } from "./components/live-dot";

export { LogRow, type LogLevel, type LogRowProps } from "./components/log-row";

export { MetaList, type MetaListItem, type MetaListProps } from "./components/meta-list";

export { NavSection, type NavSectionProps } from "./components/nav-section";

export { OfflineBanner, type OfflineBannerProps } from "./components/offline-banner";

export { Pill, PillTabs, type PillProps, type PillTabsProps } from "./components/pill-tabs";

export { ProjectSwitcher, type ProjectSwitcherProps } from "./components/project-switcher";

export { ReconnectingBar, type ReconnectingBarProps } from "./components/reconnecting-bar";

export { RelativeTime, type RelativeTimeProps } from "./components/relative-time";

export {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  type PanelImperativeHandle,
  type ResizableHandleProps,
  type ResizablePanelGroupProps,
  type ResizablePanelProps,
} from "./components/resizable-panels";

export {
  SegmentedControl,
  SegmentedItem,
  type SegmentedControlProps,
  type SegmentedItemProps,
} from "./components/segmented-control";

export {
  SidebarNavItem,
  type SidebarNavItemProps,
  type SidebarNavItemRenderProps,
} from "./components/sidebar-nav-item";

export { SourceBadge, type SourceBadgeProps } from "./components/source-badge";

export { Spinner, type SpinnerProps } from "./components/spinner";

export {
  DiffFileStatusChip,
  IssueStatusChip,
  PRStatusBadge,
  ReviewCommentStatusChip,
  ReviewStatusChip,
  RunStatusChip,
  SessionStatusChip,
  StatusChip,
  StepStatusChip,
  type PresetStatusChipProps,
  type StatusChipProps,
} from "./components/status-chip";

export { TimelineEventRow, type TimelineEventRowProps } from "./components/timeline-event-row";

export {
  toast,
  Toaster,
  type OptimisticRollbackOptions,
  type ToasterProps,
} from "./components/toaster";

export { Topbar, type TopbarProps } from "./components/topbar";
