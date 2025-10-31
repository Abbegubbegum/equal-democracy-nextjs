/**
 * Simple component to show current language and theme
 * This demonstrates that the i18n system is working
 */

import { useConfig } from "../lib/contexts/ConfigContext";

export default function LanguageThemeIndicator() {
	const { config, t, isLoading } = useConfig();

	if (isLoading) {
		return (
			<div className="fixed bottom-4 right-4 bg-yellow-200 p-2 rounded">
				Loading config...
			</div>
		);
	}

	return (
		<div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg p-4 border-2 border-red-500 z-50">
			<div className="text-xs font-bold text-red-600 mb-2">
				🔴 DEBUG INDICATOR 🔴
			</div>
			<div className="space-y-1 text-sm">
				<div>
					<span className="font-medium">Language:</span>{" "}
					<span className="text-blue-600 font-bold">
						{config.language}
					</span>
				</div>
				<div>
					<span className="font-medium">Theme:</span>{" "}
					<span className="text-blue-600 font-bold">
						{config.theme}
					</span>
				</div>
				<div>
					<span className="font-medium">Municipality:</span>{" "}
					<span className="text-blue-600 font-bold">
						{config.municipalityName}
					</span>
				</div>
				<div className="mt-3 pt-3 border-t border-gray-200">
					<div className="font-medium text-gray-700 mb-1">
						Translation Test:
					</div>
					<div className="text-blue-700 font-bold">
						appName: "{t("appName")}"
					</div>
					<div className="text-sm text-gray-600">
						common.loading: "{t("common.loading")}"
					</div>
					<div className="text-sm text-gray-600">
						auth.hello: "{t("auth.hello")}"
					</div>
				</div>
			</div>
		</div>
	);
}
