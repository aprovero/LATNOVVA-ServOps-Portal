import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Building2, Map as MapIcon, Wrench } from 'lucide-react';
import LatnovvaESPBrochure from '../components/guest/LatnovvaESPBrochure';
import GuestMapTab from '../components/guest/GuestMapTab';
import GuestEquipmentTab from '../components/guest/GuestEquipmentTab';

export default function CommercialPortal() {
    const [activeTab, setActiveTab] = useState('presentation');

    useEffect(() => {
        const oldTitle = document.title;
        document.title = "LATNOVVA";
        return () => {
            document.title = oldTitle;
        };
    }, []);

    return (
        <div className="min-h-screen bg-surface-alt flex flex-col font-sans">
            {/* Header */}
            <header className="bg-surface text-accent-greyDark h-16 flex items-center px-6 shadow-md z-10 shrink-0 border-b border-gray-100">
                <div className="flex items-center gap-4">
                    <img src="/latnovva-logo.png" alt="LATNOVVA" className="h-[20px] md:h-[26px] object-contain" />
                    <div className="w-px h-6 bg-gray-300"></div>
                    <img src="/S&S-logo.png" alt="SYS" className="h-[20px] md:h-[26px] object-contain" />
                    <div className="w-px h-6 bg-gray-300"></div>
                    <img src="/cor-logo.png" alt="CORS" className="h-[30px] md:h-[38px] object-contain" />
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col overflow-hidden relative">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full w-full">
                    {/* Tab Navigation - floating over content on presentation, integrated on map/equipment */}
                    <div className={
                        activeTab === 'presentation'
                            ? "absolute top-6 left-0 right-0 z-20 flex justify-center pointer-events-none"
                            : "bg-white border-b border-gray-100 p-3 shadow-sm shrink-0 flex justify-center z-10 relative"
                    }>
                        <TabsList className={
                            activeTab === 'presentation'
                                ? "bg-slate-900/60 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 pointer-events-auto shadow-2xl"
                                : "bg-gray-100/50 p-1.5 rounded-2xl border border-gray-100"
                        }>
                            <TabsTrigger 
                                value="presentation" 
                                className={
                                    activeTab === 'presentation'
                                        ? "rounded-xl text-white/70 data-[state=active]:bg-white data-[state=active]:text-brand-teal data-[state=active]:shadow-sm px-3 sm:px-6 py-2 sm:py-2.5 transition-all flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold hover:text-white"
                                        : "rounded-xl data-[state=active]:bg-white data-[state=active]:text-brand-teal data-[state=active]:shadow-sm px-3 sm:px-6 py-2 sm:py-2.5 transition-all flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold"
                                }
                            >
                                <Building2 size={16} className="shrink-0" />
                                <span>Our Services</span>
                            </TabsTrigger>
                            <TabsTrigger 
                                value="map" 
                                className={
                                    activeTab === 'presentation'
                                        ? "rounded-xl text-white/70 data-[state=active]:bg-white data-[state=active]:text-brand-teal data-[state=active]:shadow-sm px-3 sm:px-6 py-2 sm:py-2.5 transition-all flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold hover:text-white"
                                        : "rounded-xl data-[state=active]:bg-white data-[state=active]:text-brand-teal data-[state=active]:shadow-sm px-3 sm:px-6 py-2 sm:py-2.5 transition-all flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold"
                                }
                            >
                                <MapIcon size={16} className="shrink-0" />
                                <span>Projects Map</span>
                            </TabsTrigger>
                            <TabsTrigger 
                                value="equipment" 
                                className={
                                    activeTab === 'presentation'
                                        ? "rounded-xl text-white/70 data-[state=active]:bg-white data-[state=active]:text-brand-teal data-[state=active]:shadow-sm px-3 sm:px-6 py-2 sm:py-2.5 transition-all flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold hover:text-white"
                                        : "rounded-xl data-[state=active]:bg-white data-[state=active]:text-brand-teal data-[state=active]:shadow-sm px-3 sm:px-6 py-2 sm:py-2.5 transition-all flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold"
                                }
                            >
                                <Wrench size={16} className="shrink-0" />
                                <span>Equipment</span>
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 relative overflow-hidden h-full">
                        <TabsContent value="presentation" className="h-full m-0 p-0 data-[state=inactive]:hidden overflow-y-auto">
                            <LatnovvaESPBrochure onViewMap={() => setActiveTab('map')} />
                        </TabsContent>
                        <TabsContent value="map" className="h-full m-0 data-[state=inactive]:hidden">
                            <GuestMapTab />
                        </TabsContent>
                        <TabsContent value="equipment" className="h-full m-0 data-[state=inactive]:hidden overflow-y-auto">
                            <GuestEquipmentTab />
                        </TabsContent>
                    </div>
                </Tabs>
            </main>
        </div>
    );
}
