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
export { isEditableTarget } from "./lib/keyboard";
export { FOCUS_RING } from "./lib/focus";
export { useMediaQuery } from "./lib/use-media-query";
export { usePanelGroupLayout, type PanelGroupLayout } from "./lib/use-panel-group-layout";
export { useSidePanel, type SidePanelState } from "./lib/side-panel-context";
export { WIDE_VIEWPORT_MEDIA_QUERY } from "./lib/viewport";
export type { ConnectionState } from "./lib/connection-state";
export type { ProjectSummary } from "./lib/project-summary";

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

export { resolveStatus, type StatusDescriptor, type StatusKind } from "./lib/status";

export { TONE_TEXT, type StatusTone } from "./lib/tone";

export { Badge, type BadgeProps } from "./primitives/badge";

export { Button, type ButtonProps } from "./primitives/button";
export { buttonVariants } from "./primitives/button-variants";

export { Checkbox, type CheckboxProps } from "./primitives/checkbox";

export { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "./primitives/collapsible";

export {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  type DialogContentProps,
  type DialogDescriptionProps,
  type DialogSectionProps,
  type DialogTitleProps,
} from "./primitives/dialog";

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  type DropdownMenuCheckboxItemProps,
  type DropdownMenuContentProps,
  type DropdownMenuItemProps,
  type DropdownMenuLabelProps,
  type DropdownMenuRadioItemProps,
  type DropdownMenuSeparatorProps,
  type DropdownMenuShortcutProps,
} from "./primitives/dropdown-menu";

export { Input, type InputProps } from "./primitives/input";

export {
  Popover,
  PopoverContent,
  PopoverTrigger,
  type PopoverContentProps,
} from "./primitives/popover";

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  type SelectContentProps,
  type SelectItemProps,
  type SelectLabelProps,
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
  TooltipTrigger,
  type TooltipContentProps,
} from "./primitives/tooltip";

export { AgentAvatar, type AgentAvatarProps } from "./components/agent-avatar";
export { ProviderMark, type ProviderMarkProps } from "./components/provider-mark";
export type { ProviderMarkName } from "./lib/provider-mark-art";

export { AppShell, type AppShellProps } from "./components/app-shell";
export { useSidebarCollapsed } from "./lib/sidebar-collapsed";

export { AppSidebar, type AppSidebarProps } from "./components/app-sidebar";

export {
  SidebarDaemonStatus,
  type SidebarDaemonStatusProps,
} from "./components/sidebar-daemon-status";

export { Avatar, type AvatarProps, type AvatarShape, type AvatarSize } from "./components/avatar";

export { IssueSourceGlyph, type IssueSourceGlyphProps } from "./components/issue-source-glyph";

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

export { Markdown, type MarkdownProps } from "./components/markdown";

export { MetaList, type MetaListItem, type MetaListProps } from "./components/meta-list";

export { NavSection, type NavSectionProps } from "./components/nav-section";

export { Pill, PillTabs, type PillProps, type PillTabsProps } from "./components/pill-tabs";

export { ProjectSwitcher, type ProjectSwitcherProps } from "./components/project-switcher";

export { RelativeTime, type RelativeTimeProps } from "./components/relative-time";

export { ResizablePanel, ResizablePanelGroup } from "./primitives/resizable";

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

export { SidePanel, type SidePanelProps } from "./components/side-panel";

export { SidePanelToggle, type SidePanelToggleProps } from "./components/side-panel-toggle";

export { Spinner, type SpinnerProps } from "./components/spinner";

export { StatusChip, type StatusChipProps } from "./components/status-chip";

export {
  DiffFileStatusChip,
  IssueStatusChip,
  PRStatusBadge,
  ReviewCommentStatusChip,
  ReviewStatusChip,
  RunContributionStatusChip,
  RunStatusChip,
  StepStatusChip,
  type PresetStatusChipProps,
} from "./components/status-chips";

export { TimelineEventRow, type TimelineEventRowProps } from "./components/timeline-event-row";

export { Toaster, type ToasterProps } from "./components/toaster";
export { toast } from "sonner";

export { Topbar, type TopbarProps } from "./components/topbar";
