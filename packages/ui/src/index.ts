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
export { useMediaQuery } from "./lib/use-media-query";

export {
  ThemeProvider,
  useTheme,
  type Accent,
  type Density,
  type Theme,
  type ThemeContextValue,
  type ThemeProviderProps,
  type ThemeState,
} from "./lib/theme";

export { PROVENANCE_LABEL, PROVENANCE_VAR } from "./lib/provenance";

export {
  resolveStatus,
  TONE_TEXT,
  type StatusDescriptor,
  type StatusKind,
  type StatusTone,
} from "./lib/status";

export { Badge, type BadgeProps } from "./primitives/badge";

export { Button, type ButtonProps } from "./primitives/button";

export { Checkbox, type CheckboxProps } from "./primitives/checkbox";

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

export { AppShell, useSidebarCollapsed, type AppShellProps } from "./components/app-shell";

export { AppSidebar, type AppSidebarProps } from "./components/app-sidebar";

export {
  SidebarDaemonStatus,
  type SidebarDaemonStatusProps,
} from "./components/sidebar-daemon-status";

export { Avatar, type AvatarProps, type AvatarShape, type AvatarSize } from "./components/avatar";

export { Breadcrumbs, type BreadcrumbItem, type BreadcrumbsProps } from "./components/breadcrumbs";

export { Chip, type ChipProps, type ChipSize } from "./components/chip";

export {
  CommandPalette,
  type CommandPaletteCommand,
  type CommandPaletteGroup,
  type CommandPaletteProps,
} from "./components/command-palette";

export {
  useCommandPalette,
  type UseCommandPaletteOptions,
  type UseCommandPaletteReturn,
} from "./components/use-command-palette";

export {
  ConnectionStatusIndicator,
  type ConnectionState,
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

export { MetaList, type MetaListItem, type MetaListProps } from "./components/meta-list";

export { NavSection, type NavSectionProps } from "./components/nav-section";

export { OfflineBanner, type OfflineBannerProps } from "./components/offline-banner";

export { Pill, PillTabs, type PillProps, type PillTabsProps } from "./components/pill-tabs";

export {
  ProjectSwitcher,
  type ProjectSummary,
  type ProjectSwitcherProps,
} from "./components/project-switcher";

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

export { Spinner, type SpinnerProps } from "./components/spinner";

export {
  DiffFileStatusChip,
  IssueStatusChip,
  PRStatusBadge,
  ReviewCommentStatusChip,
  ReviewStatusChip,
  RunStatusChip,
  StatusChip,
  StepStatusChip,
  type PresetStatusChipProps,
  type StatusChipProps,
} from "./components/status-chip";

export { TimelineEventRow, type TimelineEventRowProps } from "./components/timeline-event-row";

export { toast, Toaster, type ToasterProps } from "./components/toaster";

export { Topbar, type TopbarProps } from "./components/topbar";
