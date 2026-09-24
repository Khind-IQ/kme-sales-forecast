import { InputHTMLAttributes } from 'react';

export default function Checkbox({
    className = '',
    ...props
}: InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            {...props}
            type="checkbox"
            className={
                'rounded border-base-content/15 text-primary-strong shadow-sm focus:ring-accent ' +
                className
            }
        />
    );
}
