import { InertiaLinkProps, Link } from '@inertiajs/react';

export default function NavLink({
    active = false,
    className = '',
    children,
    ...props
}: InertiaLinkProps & { active: boolean }) {
    return (
        <Link
            {...props}
            className={
                'inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium leading-5 transition duration-150 ease-in-out focus:outline-none ' +
                (active
                    ? 'border-primary text-base-content focus:border-accent'
                    : 'border-transparent text-base-content/60 hover:border-base-content/15 hover:text-base-content/80 focus:border-base-content/15 focus:text-base-content/80') +
                className
            }
        >
            {children}
        </Link>
    );
}
