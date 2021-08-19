import { C } from 'deltachat-node'

// @ts-ignore
import binding from 'deltachat-node/binding'
import { EventId2EventName } from 'deltachat-node/dist/constants'
import tempy from 'tempy'
import { lstat, rename, rm } from 'fs/promises'
import path from 'path'
import { getLogger } from '../../shared/logger'
const log = getLogger('main/deltachat/backup')

import SplitOut from './splitout'
import { DeltaChatAccount } from '../../shared/shared-types'
export default class DCBackup extends SplitOut {
  async export(dir: string) {
    this.dc.stopIO()
    try {
      await this._internal_export(dir)
    } catch (err) {
      this.dc.startIO()
      throw err
    }
    this.dc.startIO()
  }

  private async _internal_export(dir: string) {
    return new Promise<void>((resolve, reject) => {
      this.selectedAccountContext.importExport(C.DC_IMEX_EXPORT_BACKUP, dir, undefined)
      const onEventImexProgress = (data1: number) => {
        if (data1 === 0) {
          this.dc.removeListener('DC_EVENT_IMEX_PROGRESS', onEventImexProgress)
          reject('Backup export failed (progress==0)')
        } else if (data1 === 1000) {
          this.dc.removeListener('DC_EVENT_IMEX_PROGRESS', onEventImexProgress)
          resolve()
        }
      }

      this.dc.on('DC_EVENT_IMEX_PROGRESS', onEventImexProgress)
    })
  }


  import(file: string): Promise<DeltaChatAccount> {
    return new Promise((resolve, reject) => {

      const accountId = this.dc.addAccount()
      const dcnContext = this.dc.accountContext(accountId)

      const onFail = (reason: String) => {
        this.dc.removeAccount(accountId)
        reject(reason)
      }

      const onSuccess = () => resolve(this.controller.login.accountInfo(accountId))

      this.controller.on('DC_EVENT_IMEX_PROGRESS', async (event, eventAccountId, data1, data2) => {
        if (eventAccountId !== accountId) return 
        if (event === 'DC_EVENT_IMEX_PROGRESS') {
          if (data1 === 0) {
            onFail(data2)
          } else if (data1 === 1000) {
            onSuccess()
          }
        }
      })

      log.debug(`openend context`)
      log.debug(`Starting backup import of ${file}`)

      dcnContext.importExport(C.DC_IMEX_IMPORT_BACKUP, file, '')
    })
  }
}
