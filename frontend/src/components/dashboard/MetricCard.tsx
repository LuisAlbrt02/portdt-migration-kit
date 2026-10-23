import { LucideIcon } from 'lucide-react';

type Variant =
  | 'blue'
  | 'yellow'
  | 'purple'
  | 'green'
  | 'indigo'
  | 'rose'
  | 'amber';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  variant?: Variant;
  loading?: boolean;
  error?: boolean;
}

const variants = {
  blue: {
    container:
      'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700',
    icon: 'text-blue-600 dark:text-blue-400',
  },
  yellow: {
    container:
      'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700',
    icon: 'text-yellow-600 dark:text-yellow-400',
  },
  purple: {
    container:
      'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700',
    icon: 'text-purple-600 dark:text-purple-400',
  },
  green: {
    container:
      'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700',
    icon: 'text-green-600 dark:text-green-400',
  },
  indigo: {
    container:
      'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700',
    icon: 'text-indigo-600 dark:text-indigo-400',
  },
  rose: {
    container:
      'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-700',
    icon: 'text-rose-600 dark:text-rose-400',
  },
  amber: {
    container:
      'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700',
    icon: 'text-amber-600 dark:text-amber-400',
  },
};

export default function MetricCard({
  title,
  value,
  unit,
  icon: Icon,
  variant = 'blue',
  loading = false,
  error = false,
}: MetricCardProps) {
  const style = variants[variant];

  return (
    <div className={`rounded-lg border p-2 ${style.container}`}>
      <div className="flex items-center">
        <Icon className={`h-8 w-8 ${style.icon}`} />

        <div className="ml-3">
          <p className="text-base font-medium text-gray-600 dark:text-gray-300">
            {title}
          </p>

          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {loading ? '...' : value} {unit}
          </p>

          {error && (
            <p className="mt-1 text-xs text-red-500">
              Unable to load data
            </p>
          )}
        </div>
      </div>
    </div>
  );
}