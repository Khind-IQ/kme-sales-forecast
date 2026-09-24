import { ButtonHTMLAttributes } from 'react';

export default function DangerButton({
    className = '',
    disabled,
    children,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            {...props}
            className={
                `inline-flex items-center rounded-lg border border-transparent bg-error px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition duration-150 ease-in-out hover:bg-error focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-2 active:bg-error ${
                    disabled && 'opacity-25'
                } ` + className
            }
            disabled={disabled}
        >
            {children}
        </button>
    );
}
