import { InertiaLinkProps, Link } from '@inertiajs/react';

export default function ResponsiveNavLink({
    active = false,
    className = '',
    children,
    ...props
}: InertiaLinkProps & { active?: boolean }) {
    return (
        <Link
            {...props}
            className={`flex w-full items-start border-l-4 py-2 pe-4 ps-3 ${
                active
                    ? 'border-blue-500 bg-blue-50 text-blue-700 focus:border-blue-700 focus:bg-blue-100 focus:text-blue-800'
                    : 'border-transparent text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 focus:border-slate-300 focus:bg-slate-50 focus:text-slate-800'
            } text-base font-medium transition duration-150 ease-in-out focus:outline-none ${className}`}
        >
            {children}
        </Link>
    );
}
