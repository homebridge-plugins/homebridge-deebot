import { createHash } from 'node:crypto'
import { readdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'

import { HomebridgePluginUiServer } from '@homebridge/plugin-ui-utils'

const PLUGIN_NAME = '@homebridge-plugins/homebridge-ecovacs'

/**
 * Derives the Matter storage folder name for a given accessory UUID.
 * Mirrors Homebridge ExternalMatterAccessoryPublisher logic:
 *   advertiseAddress = sha1(uuid) → xx:xx:xx:xx:xx:xx → uppercase MAC
 *   uniqueId = advertiseAddress.replace(/:/g, '')
 */
function matterStorageDirForUuid(uuid) {
  const hash = createHash('sha1').update(uuid).digest('hex')
  let i = 0
  const mac = 'xx:xx:xx:xx:xx:xx'.replace(/x/g, () => hash[i++]).toUpperCase()
  return mac.replace(/:/g, '')
}

class PluginUiServer extends HomebridgePluginUiServer {
  constructor() {
    super()

    /**
     * Returns commissioning data (qrCode, manualPairingCode, commissioned, etc.)
     * for every external Matter accessory registered by this plugin.
     * Payload: { uuid: string } — if provided, filters to that UUID.
     */
    this.onRequest('/getMatterCommissioning', async ({ uuid } = {}) => {
      const storagePath = this.homebridgeStoragePath
      if (!storagePath) {
        return []
      }

      const matterPath = join(storagePath, 'matter')
      const results = []

      let dirs
      try {
        dirs = await readdir(matterPath, { withFileTypes: true })
      } catch {
        // Matter directory doesn't exist yet
        return []
      }

      for (const dirent of dirs) {
        if (!dirent.isDirectory()) {
          continue
        }
        const dir = join(matterPath, dirent.name)

        // Read accessories.json to find our plugin's accessories
        let accessories
        try {
          const raw = await readFile(join(dir, 'accessories.json'), 'utf8')
          accessories = JSON.parse(raw)
        } catch {
          continue
        }

        // Filter to accessories belonging to this plugin
        const ours = Array.isArray(accessories)
          ? accessories.filter(a => a.plugin === PLUGIN_NAME)
          : []
        if (ours.length === 0) {
          continue
        }

        // If a specific UUID was requested, skip non-matching
        if (uuid && !ours.some(a => a.uuid === uuid)) {
          continue
        }

        // Read commissioning.json
        let commissioning = {}
        try {
          const raw = await readFile(join(dir, 'commissioning.json'), 'utf8')
          commissioning = JSON.parse(raw)
        } catch {
          // no commissioning data yet
        }

        for (const acc of ours) {
          results.push({
            uuid: acc.uuid,
            displayName: acc.displayName,
            serialNumber: acc.serialNumber,
            manufacturer: acc.manufacturer,
            model: acc.model,
            qrCode: commissioning.qrCode || null,
            manualPairingCode: commissioning.manualPairingCode || null,
            commissioned: commissioning.commissioned || false,
            fabricCount: commissioning.fabricCount || 0,
          })
        }
      }

      return results
    })

    /**
     * Returns whether Matter devices are present for this plugin.
     * The UI uses this to decide whether to show the Matter or HAP device view.
     */
    this.onRequest('/isMatterActive', async () => {
      const storagePath = this.homebridgeStoragePath
      if (!storagePath) {
        return { active: false }
      }
      const matterPath = join(storagePath, 'matter')
      try {
        const dirs = await readdir(matterPath, { withFileTypes: true })
        for (const dirent of dirs) {
          if (!dirent.isDirectory()) {
            continue
          }
          const dir = join(matterPath, dirent.name)
          let accessories
          try {
            const raw = await readFile(join(dir, 'accessories.json'), 'utf8')
            accessories = JSON.parse(raw)
          } catch {
            continue
          }
          const ours = Array.isArray(accessories)
            ? accessories.filter(a => a.plugin === PLUGIN_NAME)
            : []
          if (ours.length > 0) {
            return { active: true }
          }
        }
      } catch {
        // Matter directory doesn't exist
      }
      return { active: false }
    })

    /**
     * Wipes the Matter storage folder for a given accessory UUID so it becomes
     * unpaired and will get a fresh QR code on the next Homebridge restart.
     * Payload: { uuid: string }
     */
    this.onRequest('/resetMatterDevice', async ({ uuid } = {}) => {
      if (!uuid) {
        return { success: false, error: 'uuid is required' }
      }
      const storagePath = this.homebridgeStoragePath
      if (!storagePath) {
        return { success: false, error: 'homebridgeStoragePath not available' }
      }

      const dirName = matterStorageDirForUuid(uuid)
      const targetPath = join(storagePath, 'matter', dirName)

      try {
        await rm(targetPath, { recursive: true, force: true })
        return { success: true }
      } catch (err) {
        return { success: false, error: err.message }
      }
    })

    this.ready()
  }
}

(() => new PluginUiServer())()
