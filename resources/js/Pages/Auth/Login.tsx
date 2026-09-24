import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler, useState, useEffect } from 'react';
import khindLogo from '../../Assets/logo.svg'; 

export default function Login({
    status,
    canResetPassword,
}: {
    status?: string;
    canResetPassword?: boolean;
}) {

    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false as boolean,
    });

    const [showPassword, setShowPassword] = useState(false);
    const [customError, setCustomError] = useState('');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const errorParam = params.get('error');
        if (errorParam === 'sso_failed') {
            setCustomError('Microsoft sign-in failed. Please try again.');
        } else if (errorParam === 'account_inactive') {
            setCustomError('Your account is inactive. Please contact support.');
        }
    }, []);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        setCustomError('');

        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    const handleMicrosoftLogin = () => {
        window.location.href = '/auth/microsoft/redirect';
    };

    const displayError = customError || errors.email || errors.password;

    return (
        <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
            <Head title="Log in" />

            <div className="w-full max-w-[340px]">
                <div className="bg-base-100 rounded-lg shadow-sm border border-base-300 p-5">
                    <div className="mb-5 flex justify-center">
                        <img src={khindLogo} alt="Logo" className="h-7 w-auto object-contain" />
                    </div>

                    {status && !displayError && (
                        <div className="mb-4 text-sm font-medium text-success">
                            {status}
                        </div>
                    )}

                    {customError && (
                        <div role="alert" className="mb-3 bg-error/10 border-l-4 border-error text-error px-2.5 py-2 rounded text-xs flex items-center animate-shake">
                            <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <span>{customError}</span>
                        </div>
                    )}

                    <form onSubmit={submit} className="space-y-3.5">
                        <div>
                            <label htmlFor="email" className="block text-[11px] font-bold uppercase tracking-widest text-base-content/60 mb-1">
                                Email 
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                aria-invalid={!!errors.email}
                                aria-describedby={errors.email ? 'email-error' : undefined}
                                className="w-full px-2.5 py-2 border border-base-content/15 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all outline-none bg-base-200/50 text-sm"
                                placeholder="name@khind.com"
                                required
                            />
                            {errors.email && (
                                <p id="email-error" role="alert" className="mt-1 text-xs text-error">{errors.email}</p>
                            )}
                        </div>

                        <div>
                            <div className="flex justify-between mb-1">
                                <label htmlFor="password" className="block text-[11px] font-bold uppercase tracking-widest text-base-content/60">
                                    Password
                                </label>
                                {canResetPassword && (
                                    <Link
                                        href={route('password.request')}
                                        className="text-[11px] font-bold uppercase tracking-tight text-accent hover:text-accent">
                                        Forgot Password
                                    </Link>
                                )}
                            </div>
                            <div className="relative">
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    aria-invalid={!!errors.password}
                                    aria-describedby={errors.password ? 'password-error' : undefined}
                                    className="w-full px-2.5 py-2 border border-base-content/15 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all outline-none bg-base-200/50 text-sm"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    aria-pressed={showPassword}
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-base-content/45 hover:text-base-content/70">
                                    {showPassword ? (
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                    ) : (
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    )}
                                </button>
                            </div>
                            {errors.password && (
                                <p id="password-error" role="alert" className="mt-1 text-xs text-error">{errors.password}</p>
                            )}
                        </div>

                        <div className="flex items-center">
                            <input
                                id="remember-me"
                                type="checkbox"
                                checked={data.remember}
                                onChange={(e) => setData('remember', e.target.checked)}
                                className="w-3.5 h-3.5 text-accent border-base-content/15 rounded focus:ring-accent"
                            />
                            <label htmlFor="remember-me" className="ml-2 text-xs text-base-content/60 cursor-pointer">
                                Remember this device
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full bg-primary text-primary-content py-2 rounded-lg font-bold text-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50 transition-all shadow-sm active:scale-[0.98]"
                        >
                            {processing ? 'Authenticating...' : 'Sign In'}
                        </button>
                    </form>

                    <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-base-300"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                            <span className="px-2 bg-base-100 text-base-content/45 uppercase tracking-widest">Or</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleMicrosoftLogin}
                        className="w-full bg-base-100 border border-base-content/15 text-base-content/80 py-2 rounded-lg font-medium text-sm hover:bg-base-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-base-content/40 transition-all shadow-sm active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 23 23" fill="none">
                            <path d="M11 11H0V0h11v11z" fill="#F25022"/>
                            <path d="M23 11H12V0h11v11z" fill="#7FBA00"/>
                            <path d="M11 23H0V12h11v11z" fill="#00A4EF"/>
                            <path d="M23 23H12V12h11v11z" fill="#FFB900"/>
                        </svg>
                        Sign In with Microsoft
                    </button>
                </div>

                <p className="mt-6 text-center text-[9px] text-base-content/45 uppercase tracking-[0.2em]">
                    © 2026 Khind Middle East (KME)
                </p>
            </div>

            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
                .animate-shake { animation: shake 0.4s ease-in-out; }
            `}</style>
        </div>
    );
}