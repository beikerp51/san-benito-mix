import React, { type ReactNode } from 'react';
import { X, Search, ChevronRight, ChevronDown } from 'lucide-react';

// ─── Monday Toggle Switch ───────────────────────────────────

interface MnToggleProps {
  value: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}

export const MnToggle: React.FC<MnToggleProps> = ({ value, onChange, disabled }) => (
  <button
    className={`mn-toggle ${value ? 'on' : ''} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    onClick={() => !disabled && onChange(!value)}
    role="switch"
    aria-checked={value}
  />
);

// ─── Monday Tabs ────────────────────────────────────────────

interface MnTabsProps {
  tabs: string[];
  selected: number;
  onChange: (index: number) => void;
}

export const MnTabs: React.FC<MnTabsProps> = ({ tabs, selected, onChange }) => (
  <div className="mn-tabs">
    {tabs.map((label, i) => (
      <button
        key={label}
        className={`mn-tab ${i === selected ? 'active' : ''}`}
        onClick={() => onChange(i)}
      >
        {label}
      </button>
    ))}
  </div>
);

// ─── Monday Modal ───────────────────────────────────────────

interface MnModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}

export const MnModal: React.FC<MnModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  width,
}) => {
  if (!isOpen) return null;
  return (
    <div className="mn-modal-overlay" onClick={onClose}>
      <div
        className="mn-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: width || '560px' }}
      >
        <div className="mn-modal-header">
          <h2 className="mn-modal-title">{title}</h2>
          <button className="mn-btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="mn-modal-body">{children}</div>
        {footer && <div className="mn-modal-footer">{footer}</div>}
      </div>
    </div>
  );
};

// ─── Monday Search Bar ──────────────────────────────────────

interface MnSearchProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export const MnSearch: React.FC<MnSearchProps> = ({
  value,
  onChange,
  placeholder = 'Buscar...',
}) => (
  <div className="mn-search">
    <Search size={16} color="var(--mn-text-placeholder)" />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
    {value && (
      <button onClick={() => onChange('')} className="mn-btn-icon" style={{ width: 24, height: 24 }}>
        <X size={14} />
      </button>
    )}
  </div>
);

// ─── Monday Table Row ───────────────────────────────────────

interface MnTableRowProps {
  color?: string;
  children: ReactNode;
  onClick?: () => void;
}

export const MnTableRow: React.FC<MnTableRowProps> = ({ color, children, onClick }) => (
  <tr
    className={onClick ? 'cursor-pointer' : ''}
    onClick={onClick}
    style={{ transition: 'background 0.1s ease' }}
  >
    {color && (
      <td style={{ width: 6, padding: 0 }}>
        <div className="mn-row-color" style={{ background: color }} />
      </td>
    )}
    {children}
  </tr>
);

// ─── Monday Status Pill ─────────────────────────────────────

type PillColor = 'green' | 'orange' | 'red' | 'blue' | 'purple' | 'gray';

interface MnStatusPillProps {
  label: string;
  color: PillColor;
}

export const MnStatusPill: React.FC<MnStatusPillProps> = ({ label, color }) => (
  <span className={`mn-pill mn-pill-${color}`}>{label}</span>
);

// ─── Empty State ────────────────────────────────────────────

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => (
  <div className="flex flex-col items-center justify-center py-16 px-8 text-center animate-fade-in">
    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
      style={{ background: 'var(--mn-bg)' }}>
      {icon}
    </div>
    <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--mn-text)' }}>
      {title}
    </h3>
    <p className="text-sm mb-4" style={{ color: 'var(--mn-text-secondary)' }}>
      {description}
    </p>
    {action && (
      <button className="mn-btn mn-btn-primary" onClick={action.onClick}>
        {action.label}
      </button>
    )}
  </div>
);

// ─── Stat Card ──────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  color: string;
  change?: string;
  changeColor?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  color,
  change,
  changeColor,
}) => (
  <div className="mn-stat-card">
    <div className="flex items-center justify-between">
      <span className="mn-stat-label">{label}</span>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ background: color + '18', color }}>
        {icon}
      </div>
    </div>
    <div className="mn-stat-value">{value}</div>
    {change && (
      <span className="mn-stat-change" style={{ color: changeColor || 'var(--mn-green)' }}>
        {change}
      </span>
    )}
  </div>
);

// ─── Section Header ─────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  color?: string;
  count?: number;
  collapsed?: boolean;
  onToggle?: () => void;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  color = 'var(--mn-primary)',
  count,
  collapsed,
  onToggle,
}) => (
  <div className="mn-group-header" onClick={onToggle}>
    <div className="mn-group-color" style={{ background: color }} />
    {onToggle && (collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />)}
    <span>{title}</span>
    {count !== undefined && (
      <span className="text-xs font-normal" style={{ color: 'var(--mn-text-secondary)' }}>
        {count} items
      </span>
    )}
  </div>
);

// ─── Monday / Legacy Compatibility Components ──────────────────

export const IOSSwitch = MnToggle;
export const SearchBar = MnSearch;

export interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  actions?: Array<{ label: string; onClick: () => void; destructive?: boolean }>;
}

export const ActionSheet: React.FC<ActionSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
}) => (
  <MnModal isOpen={isOpen} onClose={onClose} title={title} footer={footer}>
    {children}
  </MnModal>
);

export interface SegmentedControlProps {
  segments: string[];
  selected: number;
  onChange: (index: number) => void;
  className?: string;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  segments,
  selected,
  onChange,
  className,
}) => (
  <div className={`flex items-center gap-1 bg-[#ECEFF8] p-1 rounded-xl ${className || ''}`}>
    {segments.map((segment, index) => {
      const isActive = index === selected;
      return (
        <button
          key={segment}
          type="button"
          onClick={() => onChange(index)}
          className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all ${
            isActive
              ? 'bg-white text-[#323338] shadow-sm font-bold'
              : 'text-[#676879] hover:text-[#323338]'
          }`}
        >
          {segment}
        </button>
      );
    })}
  </div>
);

export interface SwipeAction {
  label: string;
  icon?: ReactNode;
  color: string;
  onClick: () => void;
}

export interface SwipeableRowProps {
  children: ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  className?: string;
  onClick?: () => void;
}

export const SwipeableRow: React.FC<SwipeableRowProps> = ({
  children,
  leftActions = [],
  rightActions = [],
  className,
  onClick,
}) => {
  return (
    <div
      className={`group relative bg-white border border-[#E6E9EF] rounded-xl hover:border-[#6161FF]/40 hover:shadow-sm transition-all overflow-hidden mb-2 ${className || ''}`}
    >
      <div className="flex items-center justify-between" onClick={onClick}>
        <div className="flex-1 min-w-0">{children}</div>
        {(leftActions.length > 0 || rightActions.length > 0) && (
          <div className="flex items-center gap-1.5 px-3 py-2 flex-shrink-0">
            {leftActions.map((action, i) => (
              <button
                key={`left-${i}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick();
                }}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg text-white flex items-center gap-1 shadow-sm transition-transform active:scale-95"
                style={{ background: action.color }}
                title={action.label}
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            ))}
            {rightActions.map((action, i) => (
              <button
                key={`right-${i}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick();
                }}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg text-white flex items-center gap-1 shadow-sm transition-transform active:scale-95"
                style={{ background: action.color }}
                title={action.label}
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export interface CardGroupProps {
  header?: string;
  footer?: string;
  children: ReactNode;
  className?: string;
}

export const CardGroup: React.FC<CardGroupProps> = ({
  header,
  footer,
  children,
  className,
}) => (
  <div className={`mb-6 ${className || ''}`}>
    {header && (
      <div className="text-xs font-bold text-[#676879] uppercase tracking-wider mb-2 px-1">
        {header}
      </div>
    )}
    <div className="mn-card divide-y divide-[#E6E9EF]">{children}</div>
    {footer && (
      <div className="text-xs text-[#676879] mt-2 px-1">{footer}</div>
    )}
  </div>
);

export interface CardRowProps {
  label: string;
  sublabel?: string;
  detail?: string;
  icon?: ReactNode;
  iconBg?: string;
  value?: string | ReactNode;
  chevron?: boolean;
  children?: ReactNode;
  onClick?: () => void;
  destructive?: boolean;
}

export const CardRow: React.FC<CardRowProps> = ({
  label,
  sublabel,
  detail,
  icon,
  iconBg,
  value,
  chevron,
  children,
  onClick,
  destructive,
}) => (
  <div
    className={`px-4 py-3.5 flex items-center justify-between gap-4 ${
      onClick ? 'cursor-pointer hover:bg-[#F5F6F8]' : ''
    } transition-colors`}
    onClick={onClick}
  >
    <div className="flex items-center gap-3 min-w-0">
      {icon && (
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white"
          style={{ background: iconBg || 'var(--mn-primary)' }}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <div
          className={`text-sm font-medium truncate ${
            destructive ? 'text-[#E2445C]' : 'text-[#323338]'
          }`}
        >
          {label}
        </div>
        {(detail || sublabel) && (
          <div className="text-xs text-[#676879] truncate">{detail || sublabel}</div>
        )}
      </div>
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      {value && <span className="text-sm font-semibold text-[#323338]">{value}</span>}
      {children}
      {chevron && <ChevronRight size={16} className="text-[#676879]" />}
    </div>
  </div>
);

