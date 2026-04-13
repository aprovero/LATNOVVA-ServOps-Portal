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

        // 1. Circles appearance (Staggered ring-by-ring)
        tl.fromTo(".logo-ring", 
            { scale: 0, opacity: 0 }, 
            { 
                scale: 1, 
                opacity: 1, 
                duration: 1.0, 
                stagger: {
                    each: 0.15,
                    from: "end" // Animates inner to outer
                }, 
                ease: "back.out(1.2)" 
            }
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
            {/* Wrapper that centers the entire block in the viewport */}
            <div className="flex flex-col items-start">
                
                {/* Main Logo + Branding Line */}
                <div className="flex items-center font-['Outfit']">
                    {/* LATN letters - No more flex-1, just natural flow */}
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

                    {/* 3-Ring Concentric SVG - Replaces static image for internal animation */}
                    <div className="relative w-14 h-14 sm:w-24 sm:h-24 flex items-center justify-center p-0.5 bg-white rounded-full z-10 -ml-2 sm:-ml-5">
                        <svg viewBox="0 0 100 100" className="w-full h-full">
                            {/* Outer Ring */}
                            <circle 
                                className="logo-ring origin-center text-brand-teal" 
                                cx="50" cy="50" r="42" 
                                fill="none" stroke="currentColor" strokeWidth="8"
                            />
                            {/* Middle Ring */}
                            <circle 
                                className="logo-ring origin-center text-brand-teal" 
                                cx="50" cy="50" r="28" 
                                fill="none" stroke="currentColor" strokeWidth="8"
                            />
                            {/* Inner Ring */}
                            <circle 
                                className="logo-ring origin-center text-brand-teal" 
                                cx="50" cy="50" r="14" 
                                fill="none" stroke="currentColor" strokeWidth="8"
                            />
                        </svg>
                    </div>

                    {/* VVA letters - Adjusted gap to prevent logo overlap */}
                    <div className="flex -ml-0.5 sm:-ml-1">
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

                {/* Subtitle - 25% larger and moved closer to the logo line */}
                <div className="brand-subtitle mt-2 sm:mt-3 text-[0.95rem] sm:text-xl font-semibold tracking-[0.4em] text-accent-greyLight uppercase opacity-80 font-['Outfit']">
                    Service Operations
                </div>
            </div>
        </div>
    );
};

export default SplashScreen;
