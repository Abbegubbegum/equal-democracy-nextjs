/**
 * Configuration Context for language and theme management
 * Provides translations and theme colors to all components
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { t as translate, getTranslations } from '../locales';
import { THEMES, DEFAULT_CONFIG } from '../config';

const ConfigContext = createContext();

export function ConfigProvider({ children }) {
	const [config, setConfig] = useState(DEFAULT_CONFIG);
	const [isLoading, setIsLoading] = useState(true);

	// Load configuration from server on mount
	useEffect(() => {
		async function loadConfig() {
			try {
				console.log('[ConfigContext] Loading config from /api/settings...');
				const res = await fetch('/api/settings');
				if (res.ok) {
					const data = await res.json();
					console.log('[ConfigContext] Loaded config:', data);
					if (data.language || data.theme || data.municipalityName) {
						const newConfig = {
							language: data.language || DEFAULT_CONFIG.language,
							theme: data.theme || DEFAULT_CONFIG.theme,
							municipalityName: data.municipalityName || DEFAULT_CONFIG.municipalityName,
						};
						console.log('[ConfigContext] Setting config to:', newConfig);
						setConfig(newConfig);
					}
				} else {
					console.error('[ConfigContext] Failed to fetch settings:', res.status);
				}
			} catch (error) {
				console.error('[ConfigContext] Failed to load config:', error);
			} finally {
				setIsLoading(false);
			}
		}

		loadConfig();
	}, []);

	// Translation function with current language
	const t = (key, params) => {
		return translate(config.language, key, params);
	};

	// Get theme color
	const getColor = (colorPath) => {
		const theme = THEMES[config.theme] || THEMES.default;
		const [colorGroup, shade] = colorPath.split('.');
		return theme.colors[colorGroup]?.[shade] || '#000000';
	};

	// Get all translations for current language
	const translations = getTranslations(config.language);

	// Update configuration
	const updateConfig = async (newConfig) => {
		try {
			const res = await fetch('/api/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newConfig),
			});

			if (res.ok) {
				setConfig((prev) => ({ ...prev, ...newConfig }));
				return true;
			}
			return false;
		} catch (error) {
			console.error('Failed to update config:', error);
			return false;
		}
	};

	const value = {
		config,
		t,
		getColor,
		translations,
		updateConfig,
		isLoading,
		theme: THEMES[config.theme] || THEMES.default,
	};

	return (
		<ConfigContext.Provider value={value}>
			{children}
		</ConfigContext.Provider>
	);
}

export function useConfig() {
	const context = useContext(ConfigContext);
	if (!context) {
		throw new Error('useConfig must be used within ConfigProvider');
	}
	return context;
}
