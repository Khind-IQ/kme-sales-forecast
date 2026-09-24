import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler, useState } from 'react';
import khindLogo from '../../Assets/logo.svg'; 

export default function Register() {
    const { data, setData, post, processing, errors, reset } = useForm({
        full_name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    const [showPassword, setShowPassword] = useState(false);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('register'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    // Consolidate errors for the top alert box if any exist
    const hasErrors = Object.keys(errors).length > 0;
    const firstError = Object.values(errors)[0];

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <Head title="Register" />

            <div className="w-full max-w-[340px]">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
                    <div className="mb-5 flex justify-center">
                        <img src={khindLogo} alt="Khind Logo" className="h-7 w-auto object-contain" />
                    </div>

                    <h2 className="text-center text-sm font-bold text-slate-700 mb-5 uppercase tracking-tight">
                        Create Account
                    </h2>

                    {hasErrors && (
                        <div className="mb-3 bg-red-50 border-l-4 border-red-500 text-red-700 px-2.5 py-2 rounded text-xs flex items-center animate-shake">
                            <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <span>{firstError}</span>
                        </div>
                    )}

                    <form onSubmit={submit} className="space-y-3.5">
                        {/* Full Name */}
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                                Full Name
                            </label>
                            <input
                                type="text"
                                value={data.full_name}
                                onChange={(e) => setData('full_name', e.target.value)}
                                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none bg-slate-50/50 text-sm"
                                placeholder="Full Name"
                                required
                            />
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none bg-slate-50/50 text-sm"
                                placeholder="name@khind.com"
                                required
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none bg-slate-50/50 text-sm"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? (
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                    ) : (
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                                Confirm Password
                            </label>
                            <input
                                type="password"
                                value={data.password_confirmation}
                                onChange={(e) => setData('password_confirmation', e.target.value)}
                                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none bg-slate-50/50 text-sm"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 disabled:opacity-50 transition-all shadow-sm active:scale-[0.98]"
                        >
                            {processing ? 'Creating Account...' : 'Register'}
                        </button>
                    </form>

                    <div className="mt-5 text-center">
                        <Link
                            href={route('login')}
                            className="text-xs text-blue-600 font-bold hover:underline"
                        >
                            Already have an account? Sign In
                        </Link>
                    </div>
                </div>

                <p className="mt-6 text-center text-[9px] text-slate-400 uppercase tracking-[0.2em]">
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