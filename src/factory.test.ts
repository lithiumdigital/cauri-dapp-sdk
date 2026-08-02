import { describe, expect, it } from 'vitest'
import { cauriAdapterFactory } from './factory'

describe('cauriAdapterFactory', () => {
    it('has stable providerId matching the registry entry', () => {
        expect(cauriAdapterFactory.providerId).toBe('cauri')
    })

    it('resolves mainnet apex host to the mainnet API', () => {
        const adapter = cauriAdapterFactory.create('https://cauri.cc')
        expect(adapter.getInfo().url).toBe('https://cauri.cc')
        expect(adapter.providerId).toBe('cauri')
    })

    it('resolves devnet host to the devnet API', () => {
        const adapter = cauriAdapterFactory.create('https://devnet.cauri.cc')
        expect(adapter.getInfo().url).toBe('https://devnet.cauri.cc')
    })

    it('throws when the wallet host is unknown', () => {
        expect(() => cauriAdapterFactory.create('https://unknown.example')).toThrow(
            /No apiBase mapping/,
        )
    })

    it('is case-insensitive on hostname', () => {
        expect(() => cauriAdapterFactory.create('https://Cauri.CC')).not.toThrow()
    })
})
