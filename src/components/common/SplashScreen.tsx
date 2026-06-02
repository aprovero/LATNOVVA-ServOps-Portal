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
                // Short pause before hiding the whole thing
                gsap.to(containerRef.current, {
                    opacity: 0,
                    duration: 0.8,
                    delay: 1.2,
                    ease: "power2.inOut",
                    onComplete: () => {
                        setShouldShow(false);
                        onComplete();
                    }
                });
            }
        });

        // 1. Circles appearance (Inner -> Middle -> Outer)
        tl.fromTo("#inner-circle", 
            { scale: 0, opacity: 0 }, 
            { scale: 1, opacity: 1, duration: 0.6, ease: "back.out(1.7)" }
        )
        .fromTo("#middle-circle", 
            { scale: 0, opacity: 0 }, 
            { scale: 1, opacity: 1, duration: 0.6, ease: "back.out(1.7)" }, 
            "-=0.4"
        )
        .fromTo("#outer-circle", 
            { scale: 0, opacity: 0 }, 
            { scale: 1, opacity: 1, duration: 0.6, ease: "back.out(1.7)" }, 
            "-=0.4"
        );

        // 2. Letters "LATN" and "VVA" fade in and slide out from behind the logo
        tl.fromTo(".brand-letter", 
            { opacity: 0, x: (i) => (i < 4 ? 20 : -20) }, 
            { opacity: 1, x: 0, duration: 0.8, stagger: 0.05, ease: "power3.out" },
            "-=0.2"
        );

        // 3. Subtitle "Service Operations"
        tl.fromTo(".brand-subtitle", 
            { opacity: 0, y: 10 }, 
            { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" },
            "-=0.6"
        );

    }, { scope: containerRef, dependencies: [shouldShow] });

    if (!shouldShow) return null;

    return (
        <div 
            ref={containerRef}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white"
        >
            <div className="flex flex-col items-start">
                {/* Main Logo + Branding Container */}
                <div className="flex items-center">
                    {/* LATN letters */}
                    <div className="flex gap-2 sm:gap-3">
                        {['L', 'A', 'T', 'N'].map((char, i) => (
                            <span 
                                key={`prefix-${i}`} 
                                className="brand-letter text-5xl sm:text-7xl font-black text-brand-teal"
                            >
                                {char}
                            </span>
                        ))}
                    </div>

                    {/* Concentric Circles (The "O") */}
                    <div className="relative w-12 h-12 sm:w-[5rem] sm:h-[5rem] mx-2 sm:mx-3">
                        <svg viewBox="0 0 100 100" className="w-full h-full">
                            <circle 
                                id="outer-circle" 
                                cx="50" cy="50" r="44" 
                                fill="none" stroke="#0F766E" strokeWidth="9" 
                            />
                            <circle 
                                id="middle-circle" 
                                cx="50" cy="50" r="28" 
                                fill="none" stroke="#0F766E" strokeWidth="9" 
                            />
                            <circle 
                                id="inner-circle" 
                                cx="50" cy="50" r="12" 
                                fill="none" stroke="#0F766E" strokeWidth="9" 
                            />
                        </svg>
                    </div>

                    {/* VVA letters */}
                    <div className="flex gap-2 sm:gap-3">
                        {['V', 'V', 'A'].map((char, i) => (
                            <span 
                                key={`suffix-${i}`} 
                                className="brand-letter text-5xl sm:text-7xl font-black text-brand-teal"
                            >
                                {char}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Subtitle */}
                {/* Aligned to the left, slightly offset to visually center under LATNOVVA without looking disjointed. A tiny ml-1 or ml-2 matches the L's visual weight. */}
                <div className="brand-subtitle mt-2 sm:mt-3 ml-1 sm:ml-2 text-sm sm:text-lg font-medium tracking-[0.3em] text-accent-greyLight uppercase">
                    Service Operations
                </div>
            </div>
        </div>
    );
};

export default SplashScreen;
