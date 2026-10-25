import { describe, expect, it } from 'vitest'
import { detectPluginPermissions } from './pluginPermissionUsage'

describe('detectPluginPermissions', () => {
    it('maps each API call to the permission it asks for', () => {
        const script = `
            const db = await risuai.getDatabase(['personas'])
            const doc = await risuai.getRootDocument()
            await risuai.addRisuReplacer('beforeRequest', fn)
            risuai.addProvider('my-model', handler)
            await risuai.sendChat('hello')
            const logs = await risuai.getFetchLogs()
            const img = await risuai.readInlay(id)
        `
        expect(detectPluginPermissions(script)).toEqual(['fetchLogs', 'db', 'mainDom', 'replacer', 'provider', 'sendChat', 'inlay'])
    })

    it('counts every API that asks for the replacer permission', () => {
        expect(detectPluginPermissions('risuai.addRisuChatListener("output", f)')).toEqual(['replacer'])
        expect(detectPluginPermissions('await risuai.registerBodyIntercepter(cb)')).toEqual(['replacer'])
    })

    it('reads a literal requestPluginPermission name and ignores unknown ones', () => {
        expect(detectPluginPermissions(`await risuai.requestPluginPermission('inlay')`)).toEqual(['inlay'])
        expect(detectPluginPermissions('risuai.requestPluginPermission( "mainDom" )')).toEqual(['mainDom'])
        expect(detectPluginPermissions(`risuai.requestPluginPermission('everything')`)).toEqual([])
    })

    it('does not match an API name inside a longer identifier', () => {
        expect(detectPluginPermissions('const getDatabaseSize = 1; mySendChatButton()')).toEqual([])
    })

    it('returns nothing for a plugin that uses no gated API', () => {
        expect(detectPluginPermissions('risuai.log("hi"); await risuai.getChar()')).toEqual([])
    })
})
