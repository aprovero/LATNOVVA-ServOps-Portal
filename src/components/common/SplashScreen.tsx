import React, { useEffect, useState, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

interface SplashScreenProps {
    onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [shouldShow, setShouldShow] = useState(false);

    useEffect(() => {
        // Check session storage
        const hasShown = sessionStorage.getItem('latnovva_splash_shown');
        if (!hasShown) {
            setShouldShow(true);
        } else {
            onComplete();
        }

        // Listener for manual preview (no reload)
        const handlePreview = () => {
            sessionStorage.removeItem('latnovva_splash_shown');
            setShouldShow(true);
        };
        window.addEventListener('preview-splash', handlePreview);
        return () => window.removeEventListener('preview-splash', handlePreview);
    }, [onComplete]);

    useGSAP(() => {
        if (!shouldShow) return;

        const tl = gsap.timeline({
            onComplete: () => {
                sessionStorage.setItem('latnovva_splash_shown', 'true');
                // Longer pause before hiding the whole thing
                gsap.to(containerRef.current, {
                    opacity: 0,
                    duration: 1.0,
                    delay: 2.5,
                    ease: "power2.inOut",
                    onComplete: () => {
                        setShouldShow(false);
                        onComplete();
                    }
                });
            }
        });

        // 1. Circles appearance (The "O" from official source)
        tl.fromTo("#rings-logo", 
            { scale: 0, opacity: 0 }, 
            { scale: 1, opacity: 1, duration: 1.2, ease: "back.out(1.2)" }
        );

        // 2. Letters "LATN" and "VVA" fade in and slide out
        tl.fromTo(".brand-letter", 
            { opacity: 0, x: (i) => (i < 4 ? 20 : -20) }, 
            { opacity: 1, x: 0, duration: 1.2, stagger: 0.08, ease: "power3.out" },
            "-=0.4"
        );

        // 3. Subtitle "Service Operations"
        tl.fromTo(".brand-subtitle", 
            { opacity: 0, scale: 0.95 }, 
            { opacity: 1, scale: 1, duration: 1.0, ease: "power2.out" },
            "-=0.8"
        );

    }, { scope: containerRef, dependencies: [shouldShow] });

    if (!shouldShow) return null;

    return (
        <div 
            ref={containerRef}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white"
        >
            <div className="flex flex-col items-center w-full max-w-4xl px-8">
                {/* Main Logo + Branding Container */}
                <div className="flex items-center justify-center font-['Outfit'] w-full">
                    {/* LATN letters container - flex-1 and justify-end makes the Logo the exact center */}
                    <div className="flex-1 flex justify-end">
                        <div className="flex">
                            {['L', 'A', 'T', 'N'].map((char, i) => (
                                <span 
                                    key={`prefix-${i}`} 
                                    className="brand-letter text-4xl sm:text-7xl font-black text-brand-teal tracking-[0.25em]"
                                >
                                    {char}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Concentric Circles (The "O") - Center gravity of the splash screen */}
                    <div className="relative w-16 h-16 sm:w-28 sm:h-28 flex items-center justify-center p-1 bg-white rounded-full z-10 mx-1">
                        <img 
                            id="rings-logo"
                            src="/latnovva-O-logo.png" 
                            alt="O" 
                            className="w-full h-full object-contain"
                        />
                    </div>

                    {/* VVA letters container - flex-1 and justify-start balances the LATN side */}
                    <div className="flex-1 flex justify-start">
                        <div className="flex">
                            {['V', 'V', 'A'].map((char, i) => (
                                <span 
                                    key={`suffix-${i}`} 
                                    className="brand-letter text-4xl sm:text-7xl font-black text-brand-teal tracking-[0.25em]"
                                >
                                    {char}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Subtitle - Exact horizontal alignment with the Logo */}
                <div className="brand-subtitle mt-8 text-xs sm:text-base font-semibold tracking-[0.4em] text-accent-greyLight uppercase opacity-80 font-['Outfit'] relative">
                    <span className="pl-[0.4em]">Service Operations</span>
                </div>
            </div>
        </div>
    );
};

export default SplashScreen;
