/**
 * Configuration Context for language and theme management
 * Provides translations and theme colors to all components
 */

import { createContext, useContext, useState, useEffect } from "react";
import { t as translate, getTranslations } from "../locales";
import { THEMES, DEFAULT_CONFIG } from "../config";

const ConfigContext = createContext();

export function ConfigProvider({ children }) {
	const [config, setConfig] = useState(DEFAULT_CONFIG);
	const [isLoading, setIsLoading] = useState(true);

	// Load configuration from server on mount
	useEffect(() => {
		async function loadConfig() {
			try {
				const res = await fetch("/api/settings");
				if (res.ok) {
					const data = await res.json();
					console.log("[ConfigContext] Loaded config:", data);
					if (data.language || data.theme || data.municipalityName) {
						const newConfig = {
							language: data.language || DEFAULT_CONFIG.language,
							theme: data.theme || DEFAULT_CONFIG.theme,
							municipalityName:
								data.municipalityName ||
								DEFAULT_CONFIG.municipalityName,
						};
						setConfig(newConfig);
					}
				} else {
					console.error(
						"[ConfigContext] Failed to fetch settings:",
						res.status
					);
				}
			} catch (error) {
				console.error("[ConfigContext] Failed to load config:", error);
			} finally {
				setIsLoading(false);
			}
		}

		loadConfig();
	}, []);

	// Apply theme colors as CSS variables whenever theme changes
	useEffect(() => {
		const theme = THEMES[config.theme] || THEMES.default;
		const root = document.documentElement;

		// Set primary colors
		root.style.setProperty("--theme-primary-50", theme.colors.primary[50]);
		root.style.setProperty(
			"--theme-primary-100",
			theme.colors.primary[100]
		);
		root.style.setProperty(
			"--theme-primary-400",
			theme.colors.primary[400]
		);
		root.style.setProperty(
			"--theme-primary-500",
			theme.colors.primary[500]
		);
		root.style.setProperty(
			"--theme-primary-600",
			theme.colors.primary[600]
		);
		root.style.setProperty(
			"--theme-primary-700",
			theme.colors.primary[700]
		);
		root.style.setProperty(
			"--theme-primary-800",
			theme.colors.primary[800]
		);
		root.style.setProperty(
			"--theme-primary-900",
			theme.colors.primary[900]
		);

		// Set accent colors
		root.style.setProperty("--theme-accent-50", theme.colors.accent[50]);
		root.style.setProperty("--theme-accent-100", theme.colors.accent[100]);
		root.style.setProperty("--theme-accent-400", theme.colors.accent[400]);
		root.style.setProperty("--theme-accent-500", theme.colors.accent[500]);
		root.style.setProperty("--theme-accent-600", theme.colors.accent[600]);

		console.log("[ConfigContext] Applied theme colors:", config.theme);
	}, [config.theme]);

	// Translation function with current language
	const t = (key, params) => {
		return translate(config.language, key, params);
	};

	// Get theme color
	const getColor = (colorPath) => {
		const theme = THEMES[config.theme] || THEMES.default;
		const [colorGroup, shade] = colorPath.split(".");
		return theme.colors[colorGroup]?.[shade] || "#000000";
	};

	// Get all translations for current language
	const translations = getTranslations(config.language);

	// Update configuration
	const updateConfig = async (newConfig) => {
		try {
			const res = await fetch("/api/settings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(newConfig),
			});

			if (res.ok) {
				setConfig((prev) => ({ ...prev, ...newConfig }));
				return true;
			}
			return false;
		} catch (error) {
			console.error("Failed to update config:", error);
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
		throw new Error("useConfig must be used within ConfigProvider");
	}
	return context;
}
