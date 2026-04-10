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
                    onComplete: onComplete
                });
            }
        });

        // 1. Circles appearance (Inner -> Middle -> Outer) - Slightly slower
        tl.fromTo("#inner-circle", 
            { scale: 0, opacity: 0 }, 
            { scale: 1, opacity: 1, duration: 0.8, ease: "back.out(1.7)" }
        )
        .fromTo("#middle-circle", 
            { scale: 0, opacity: 0 }, 
            { scale: 1, opacity: 1, duration: 0.8, ease: "back.out(1.7)" }, 
            "-=0.6"
        )
        .fromTo("#outer-circle", 
            { scale: 0, opacity: 0 }, 
            { scale: 1, opacity: 1, duration: 0.8, ease: "back.out(1.7)" }, 
            "-=0.6"
        );

        // 2. Letters "LATN" and "VVA" fade in and slide out from behind the logo - Slower
        tl.fromTo(".brand-letter", 
            { opacity: 0, x: (i) => (i < 4 ? 20 : -20) }, 
            { opacity: 1, x: 0, duration: 1.2, stagger: 0.08, ease: "power3.out" },
            "-=0.4"
        );

        // 3. Subtitle "Service Operations"
        tl.fromTo(".brand-subtitle", 
            { opacity: 0, y: 15 }, 
            { opacity: 1, y: 0, duration: 1.0, ease: "power2.out" },
            "-=0.8"
        );

    }, { scope: containerRef, dependencies: [shouldShow] });

    if (!shouldShow) return null;

    return (
        <div 
            ref={containerRef}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white"
        >
            <div className="flex flex-col items-center">
                {/* Main Logo + Branding Container */}
                <div className="flex items-center justify-center">
                    {/* LATN letters */}
                    <div className="flex -mr-1 sm:-mr-2">
                        {['L', 'A', 'T', 'N'].map((char, i) => (
                            <span 
                                key={`prefix-${i}`} 
                                className="brand-letter text-4xl sm:text-7xl font-black text-brand-teal tracking-[-0.05em]"
                                style={{ fontFeatureSettings: '"tnum" on, "lnum" on' }}
                            >
                                {char}
                            </span>
                        ))}
                    </div>

                    {/* Concentric Circles (The "O") */}
                    <div className="relative w-16 h-16 sm:w-28 sm:h-28">
                        <svg viewBox="0 0 100 100" className="w-full h-full">
                            <circle 
                                id="outer-circle" 
                                cx="50" cy="50" r="44" 
                                fill="none" stroke="#0F766E" strokeWidth="12" 
                            />
                            <circle 
                                id="middle-circle" 
                                cx="50" cy="50" r="28" 
                                fill="none" stroke="#0F766E" strokeWidth="12" 
                            />
                            <circle 
                                id="inner-circle" 
                                cx="50" cy="50" r="12" 
                                fill="none" stroke="#0F766E" strokeWidth="12" 
                            />
                        </svg>
                    </div>

                    {/* VVA letters */}
                    <div className="flex -ml-1 sm:-ml-2">
                        {['V', 'V', 'A'].map((char, i) => (
                            <span 
                                key={`suffix-${i}`} 
                                className="brand-letter text-4xl sm:text-7xl font-black text-brand-teal tracking-[-0.05em]"
                                style={{ fontFeatureSettings: '"tnum" on, "lnum" on' }}
                            >
                                {char}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Subtitle */}
                <div className="brand-subtitle mt-8 text-xs sm:text-base font-semibold tracking-[0.4em] text-accent-greyLight uppercase opacity-80">
                    Service Operations
                </div>
            </div>
        </div>
    );
};

export default SplashScreen;
