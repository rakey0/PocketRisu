import { beforeEach, describe, expect, test, vi } from 'vitest'

// Card toggles ({{getglobalvar::toggle_X}}) live in db.globalChatVariables.
// Plugins with database access may read them, but no write path may change
// them: a plugin saving back a database it read earlier would undo a toggle
// flipped in between.
const mocks = vi.hoisted(() => ({
    DBState: { db: {} as any },
    storage: new Map<string, unknown>(),
}))

vi.mock('../../lang', () => ({ language: {} }))
vi.mock('../alert', () => ({ alertConfirm: vi.fn(), alertError: vi.fn(), alertPluginConfirm: vi.fn() }))
vi.mock('../util', () => ({ selectSingleFile: vi.fn(), sleep: vi.fn() }))
vi.mock('../globalApi.svelte', () => ({
    fetchNative: vi.fn(),
    globalFetch: vi.fn(),
    readImage: vi.fn(),
    requestImmediateSave: vi.fn(),
    saveAsset: vi.fn(),
    toGetter: vi.fn(),
}))
vi.mock('../storage/database.svelte', () => ({
    getCurrentCharacter: vi.fn(),
    getDatabase: () => mocks.DBState.db,
    setDatabase: vi.fn(),
    setDatabaseLite: vi.fn(),
}))
vi.mock('../stores.svelte', async () => {
    const { writable } = await import('svelte/store')
    return {
        DBState: mocks.DBState,
        hotReloading: writable([]),
        pluginAlertModalStore: writable({}),
        selectedCharID: writable(0),
    }
})
vi.mock('./pluginSafety', () => ({ checkCodeSafety: vi.fn() }))
vi.mock('./pluginSafeClass', () => ({ SafeDocument: class {}, SafeIdbFactory: class {}, SafeLocalStorage: class {} }))
vi.mock('./apiV3/v3.svelte', () => ({ loadV3Plugins: vi.fn(), reloadV3Plugin: vi.fn() }))
vi.mock('./apiV3/transpiler', () => ({ pluginCodeTranspiler: vi.fn() }))
vi.mock('./pluginStorageStore', () => ({
    getItemSync: (key: string) => mocks.storage.get(key),
    setItemSync: (key: string, value: unknown) => { mocks.storage.set(key, value) },
    removeItemSync: (key: string) => { mocks.storage.delete(key) },
    has: (key: string) => mocks.storage.has(key),
    keys: () => [...mocks.storage.keys()],
}))
vi.mock('./pluginCharacterSnapshot', () => ({
    hydratePluginCharacterSnapshotSync: vi.fn(),
    restorePluginCharacterManifest: vi.fn(),
    restorePluginDbKey: (_key: string, value: unknown) => value,
}))

import { getV2PluginAPIs } from './plugins.svelte'

beforeEach(() => {
    mocks.storage.clear()
    mocks.DBState.db = {
        characters: [],
        globalChatVariables: { toggle_UserSet: '0' },
    }
})

describe('plugin access to globalChatVariables', () => {
    test('the V2 db proxy hands out a copy', () => {
        const db = getV2PluginAPIs().getDatabase() as any
        expect(Object.keys(db)).toContain('globalChatVariables')
        expect(db.globalChatVariables).toEqual({ toggle_UserSet: '0' })
        db.globalChatVariables.toggle_UserSet = '1'
        expect(mocks.DBState.db.globalChatVariables).toEqual({ toggle_UserSet: '0' })
    })

    test('assigning it through the V2 db proxy is ignored', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const db = getV2PluginAPIs().getDatabase() as any
        db.globalChatVariables = { toggle_UserSet: '1' }
        expect(mocks.DBState.db.globalChatVariables).toEqual({ toggle_UserSet: '0' })
        expect(mocks.storage.has('globalChatVariables')).toBe(false)
        expect(warn).toHaveBeenCalledOnce()
        warn.mockRestore()
    })

    test.each(['setDatabaseLite', 'setDatabase'] as const)('%s skips it and applies the other keys', async (fn) => {
        await getV2PluginAPIs()[fn]({ characters: ['c'], globalChatVariables: { toggle_UserSet: '1' }, custom: 'v' })
        expect(mocks.DBState.db.globalChatVariables).toEqual({ toggle_UserSet: '0' })
        expect(mocks.DBState.db.characters).toEqual(['c'])
        expect(mocks.storage.has('globalChatVariables')).toBe(false)
        expect(mocks.storage.get('custom')).toBe('v')
    })
})
