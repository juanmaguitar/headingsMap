import React, { useEffect, useState } from 'react';
import '../styles/main.css';

interface Settings {
  showHeadLevels: boolean;
  showHeadError: boolean;
  showHeadErrorH1: boolean;
  showOutLevels: boolean;
  showOutElem: boolean;
  showOutError: boolean;
}

const defaultSettings: Settings = {
  showHeadLevels: true,
  showHeadError: true,
  showHeadErrorH1: true,
  showOutLevels: true,
  showOutElem: true,
  showOutError: true,
};

const Options: React.FC = () => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const headingsMapPort = chrome.runtime.connect({ name: 'port-from-cs' });

  useEffect(() => {
    // Load settings from storage
    chrome.storage.local.get(
      [
        'showHeadLevels',
        'showHeadError',
        'showHeadErrorH1',
        'showOutLevels',
        'showOutElem',
        'showOutError',
      ],
      (values) => {
        setSettings({ ...defaultSettings, ...values });
      }
    );
  }, []);

  const handleOptionChange = (key: keyof Settings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    // Save to storage
    chrome.storage.local.set({ [key]: value });
    
    // Notify to update
    headingsMapPort.postMessage({ action: 'update' });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">
          HeadingsMap Configuration
        </h1>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Headings Structure Section */}
          <fieldset className="border border-gray-300 rounded-lg p-6">
            <legend className="text-xl font-semibold text-gray-700 px-2">
              Headings structure
            </legend>
            
            <div className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <label htmlFor="showHeadLevels" className="text-gray-700">
                  Show heading level:
                </label>
                <select
                  id="showHeadLevels"
                  value={settings.showHeadLevels.toString()}
                  onChange={(e) =>
                    handleOptionChange('showHeadLevels', e.target.value === 'true')
                  }
                  className="ml-4 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <label htmlFor="showHeadError" className="text-gray-700">
                  Identify errors:
                </label>
                <select
                  id="showHeadError"
                  value={settings.showHeadError.toString()}
                  onChange={(e) =>
                    handleOptionChange('showHeadError', e.target.value === 'true')
                  }
                  className="ml-4 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <label htmlFor="showHeadErrorH1" className="text-gray-700">
                  Error if first heading is not h1:
                </label>
                <select
                  id="showHeadErrorH1"
                  value={settings.showHeadErrorH1.toString()}
                  onChange={(e) =>
                    handleOptionChange('showHeadErrorH1', e.target.value === 'true')
                  }
                  className="ml-4 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            </div>
          </fieldset>

          {/* HTML5 Outline Section */}
          <fieldset className="border border-gray-300 rounded-lg p-6">
            <legend className="text-xl font-semibold text-gray-700 px-2">
              HTML 5 Outline
            </legend>
            
            <div className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <label htmlFor="showOutLevels" className="text-gray-700">
                  Show section index:
                </label>
                <select
                  id="showOutLevels"
                  value={settings.showOutLevels.toString()}
                  onChange={(e) =>
                    handleOptionChange('showOutLevels', e.target.value === 'true')
                  }
                  className="ml-4 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <label htmlFor="showOutElem" className="text-gray-700">
                  Show tag name:
                </label>
                <select
                  id="showOutElem"
                  value={settings.showOutElem.toString()}
                  onChange={(e) =>
                    handleOptionChange('showOutElem', e.target.value === 'true')
                  }
                  className="ml-4 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <label htmlFor="showOutError" className="text-gray-700">
                  Error if section without heading:
                </label>
                <select
                  id="showOutError"
                  value={settings.showOutError.toString()}
                  onChange={(e) =>
                    handleOptionChange('showOutError', e.target.value === 'true')
                  }
                  className="ml-4 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            </div>
          </fieldset>
        </div>
      </div>
    </div>
  );
};

export default Options;
