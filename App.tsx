
import React, { useState } from 'react';
import ScopusTab from './components/ScopusTab';
import OrcidTab from './components/OrcidTab';
import BatchTab from './components/BatchTab';
import ZenodoTab from './components/ZenodoTab';
import ApaGeneratorTab from './components/ApaGeneratorTab';
import UnifiedProfileTab from './components/UnifiedProfileTab';
import MainMenu from './components/MainMenu';
import SettingsDropdown from './components/SettingsDropdown';
import { useLanguage } from './contexts/LanguageContext';
import InstructionsTab from './components/InstructionsTab';
import OpenAlexTab from './components/OpenAlexTab';
import HIndexCalculatorTab from './components/HIndexCalculatorTab';
import ManualVisualizerTab from './components/ManualVisualizerTab';
import UnpaywallTab from './components/UnpaywallTab';
import ScopusCitationTab from './components/ScopusCitationTab';
import Sidebar from './components/Sidebar';
import AdvancedSearchTab from './components/AdvancedSearchTab';
import RadioTab from './components/RadioTab';
import UsefulLinksTab from './components/UsefulLinksTab';
import GlobalPlayer from './components/GlobalPlayer';
import MusicLibraryModal from './components/MusicLibraryModal';
import { logEvent } from './services/analyticsService';

export type Tab = 'instructions' | 'scopus' | 'orcid' | 'unifiedProfile' | 'batch' | 'zenodo' | 'apaGenerator' | 'openalex' | 'hIndexCalculator' | 'manualVisualizer' | 'unpaywall' | 'scopusCitation' | 'advancedSearch' | 'radio' | 'usefulLinks';

const TabContent: React.FC<{ activeTab: Tab }> = ({ activeTab }) => (
  <div className="animate-slide-in-up">
    {activeTab === 'instructions' && <InstructionsTab />}
    {activeTab === 'scopus' && <ScopusTab />}
    {activeTab === 'orcid' && <OrcidTab />}
    {activeTab === 'unifiedProfile' && <UnifiedProfileTab />}
    {activeTab === 'advancedSearch' && <AdvancedSearchTab />}
    {activeTab === 'batch' && <BatchTab />}
    {activeTab === 'zenodo' && <ZenodoTab />}
    {activeTab === 'hIndexCalculator' && <HIndexCalculatorTab />}
    {activeTab === 'apaGenerator' && <ApaGeneratorTab />}
    {activeTab === 'openalex' && <OpenAlexTab />}
    {activeTab === 'manualVisualizer' && <ManualVisualizerTab />}
    {activeTab === 'unpaywall' && <UnpaywallTab />}
    {activeTab === 'scopusCitation' && <ScopusCitationTab />}
    {activeTab === 'radio' && <RadioTab />}
    {activeTab === 'usefulLinks' && <UsefulLinksTab />}
  </div>
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('scopus');
  const [currentView, setCurrentView] = useState<'menu' | 'tabs'>('menu');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { t } = useLanguage();

  const handleMenuSelect = (tab: Tab) => {
    setActiveTab(tab);
    setCurrentView('tabs');
    logEvent('module_used', { module: tab });
  };
  
  const handleGoHome = () => {
    setCurrentView('menu');
    logEvent('navigation', { destination: 'home_menu' });
  };

  return (
    <div className="flex h-screen bg-secondary-50 font-sans overflow-hidden">
      
      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        currentView={currentView}
        onSelectTab={handleMenuSelect}
        onGoHome={handleGoHome}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
        
        {/* Top Header */}
        <header className="bg-white/90 backdrop-blur-sm border-b border-secondary-200 z-30 flex-shrink-0">
          <div className="px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2 -ml-2 rounded-md text-secondary-500 hover:bg-secondary-100 hover:text-secondary-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              
              <h1 className="text-xl font-bold text-secondary-800 truncate">
                {currentView === 'menu' ? t('appTitle') : t(`menu${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}Title` as any, { defaultValue: t('usefulLinksTitle') })}
              </h1>
            </div>

            <div className="flex items-center gap-3">
               <SettingsDropdown />
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 custom-scrollbar pb-28">
          <div className="max-w-7xl mx-auto">
            {currentView === 'menu' ? (
              <MainMenu onSelect={handleMenuSelect} />
            ) : (
              <TabContent activeTab={activeTab} />
            )}
          </div>
        </main>
        
        <GlobalPlayer />
        <MusicLibraryModal />
      </div>
    </div>
  );
};

export default App;
