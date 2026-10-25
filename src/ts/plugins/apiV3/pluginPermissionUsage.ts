import { pluginPermissions, type PluginPermission } from './pluginPermissionCache'

// The plugin API calls that ask for each permission (makeRisuaiAPIV3 in v3.svelte.ts).
const permissionApis: Record<PluginPermission, string[]> = {
    db: ['getDatabase'],
    mainDom: ['getRootDocument'],
    replacer: ['addRisuReplacer', 'addRisuChatListener', 'registerBodyIntercepter'],
    provider: ['addProvider'],
    sendChat: ['sendChat'],
    fetchLogs: ['getFetchLogs'],
    inlay: ['readInlay'],
}

const apiPatterns = Object.fromEntries(
    pluginPermissions.map((permission) => [
        permission,
        new RegExp(`\\b(?:${permissionApis[permission].join('|')})\\b`),
    ]),
) as Record<PluginPermission, RegExp>

const requestPattern = /\brequestPluginPermission\s*\(\s*['"`](\w+)['"`]/g

// Guesses which permissions a plugin asks for by looking for those API names
// in its code, plus requestPluginPermission('…') calls with a literal name.
// A plugin that builds the name at runtime is missed, and a name that only
// appears in a comment still counts, so the settings page shows this as a hint
// next to the permissions that were actually asked.
export function detectPluginPermissions(script: string): PluginPermission[] {
    const found = new Set<PluginPermission>()
    for (const permission of pluginPermissions) {
        if (apiPatterns[permission].test(script)) found.add(permission)
    }
    for (const match of script.matchAll(requestPattern)) {
        const name = match[1] as PluginPermission
        if (pluginPermissions.includes(name)) found.add(name)
    }
    return pluginPermissions.filter((permission) => found.has(permission))
}
