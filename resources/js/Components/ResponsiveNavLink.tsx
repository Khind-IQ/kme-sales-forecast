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
                    ? 'border-primary bg-primary/10 text-primary-strong focus:border-accent focus:bg-primary/20 focus:text-primary-strong'
                    : 'border-transparent text-base-content/70 hover:border-base-content/15 hover:bg-base-200 hover:text-base-content focus:border-base-content/15 focus:bg-base-200 focus:text-base-content'
            } text-base font-medium transition duration-150 ease-in-out focus:outline-none ${className}`}
        >
            {children}
        </Link>
    );
}
