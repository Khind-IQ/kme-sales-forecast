import ApplicationLogo from '@/Components/ApplicationLogo';
import { Link } from '@inertiajs/react';
import { PropsWithChildren } from 'react';
import khindLogo from '../Assets/logo.svg'; 


export default function Guest({ children }: PropsWithChildren) {
    return (
        <div className="flex min-h-screen flex-col items-center bg-base-200 pt-6 sm:justify-center sm:pt-0">
            <div>
                  <img src={khindLogo} alt="Khind Logo" className="h-7 w-auto object-contain" />
            </div>

            <div className="mt-6 w-full overflow-hidden bg-base-100 border border-base-300 px-6 py-4 shadow-sm sm:max-w-md sm:rounded-xl">
                {children}
            </div>
        </div>
    );
}
