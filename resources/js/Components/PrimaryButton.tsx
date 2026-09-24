import { ButtonHTMLAttributes } from 'react';

export default function PrimaryButton({
    className = '',
    disabled,
    children,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            {...props}
            className={
                `inline-flex items-center rounded-lg border border-transparent bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-content transition duration-150 ease-in-out hover:bg-primary-hover focus:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 active:bg-primary-hover ${
                    disabled && 'opacity-25'
                } ` + className
            }
            disabled={disabled}
        >
            {children}
        </button>
    );
}
