<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, ref } from 'vue'

import { useAppSettingsStore, useEnvStore, useKernelApiStore } from '@/stores'
import {
  GrantTUNPermission,
  getGitHubApiAuthorization,
  ignoredError,
  getKernelFileName,
  message,
  confirm,
} from '@/utils'
import { CoreWorkingDirectory } from '@/constant'
import {
  Download,
  HttpCancel,
  UnzipZIPFile,
  HttpGet,
  Exec,
  Movefile,
  Removefile,
  GetEnv,
  Makedir,
  UnzipGZFile,
  AbsolutePath,
  BrowserOpenURL,
} from '@/bridge'

const alphaUrl = 'https://api.github.com/repos/MetaCubeX/mihomo/releases/tags/Prerelease-Alpha'
const alphaVersionUrl =
  'https://github.com/MetaCubeX/mihomo/releases/download/Prerelease-Alpha/version.txt'
const localVersion = ref('')
const remoteVersion = ref('')
const versionDetail = ref('')
const localVersionLoading = ref(false)
const remoteVersionLoading = ref(false)
const downloadLoading = ref(false)
const downloadSuccessful = ref(false)

const needRestart = computed(() => {
  const { running, branch } = appSettings.app.kernel
  if (!running) return false
  return localVersion.value && downloadSuccessful.value && branch === 'alpha'
})

const needUpdate = computed(() => remoteVersion.value && localVersion.value !== remoteVersion.value)

const { t } = useI18n()
const envStore = useEnvStore()
const appSettings = useAppSettingsStore()
const kernelApiStore = useKernelApiStore()

const updateLocalVersion = async (showTips = false) => {
  localVersion.value = await getLocalVersion(showTips)
}

const updateRemoteVersion = async (showTips = false) => {
  remoteVersion.value = await getRemoteVersion(showTips)
}

const downloadCore = async () => {
  downloadLoading.value = true
  try {
    const { body } = await HttpGet<Record<string, any>>(alphaUrl, {
      Authorization: getGitHubApiAuthorization(),
    })
    const { os, arch } = await GetEnv()

    const { assets, message: msg } = body
    if (msg) throw msg

    const amd64Compatible = arch === 'amd64' && envStore.env.x64Level < 3 ? '-compatible' : ''
    const suffix = { windows: '.zip', linux: '.gz', darwin: '.gz' }[os]
    const assetName = `mihomo-${os}-${arch}${amd64Compatible}-${remoteVersion.value}${suffix}`

    const asset = assets.find((v: any) => v.name === assetName)
    if (!asset) throw 'Asset Not Found:' + assetName

    if (asset.uploader.type !== 'Bot') {
      await confirm('common.warning', 'settings.kernel.risk', {
        type: 'text',
        okText: 'settings.kernel.stillDownload',
      })
    }

    const tmp = `data/core-alpha${suffix}` // data/core-alpha.zip or data/core-alpha.gz

    await Makedir('data/mihomo')

    const { id } = message.info(t('common.downloading'), 10 * 60 * 1_000, () => {
      HttpCancel('download-alpha-core')
      setTimeout(() => Removefile(tmp), 1000)
    })

    await Download(
      asset.browser_download_url,
      tmp,
      undefined,
      (progress, total) => {
        message.update(id, t('common.downloading') + ((progress / total) * 100).toFixed(2) + '%')
      },
      { CancelId: 'download-alpha-core' },
    ).catch((err) => {
      message.destroy(id)
      throw err
    })

    message.destroy(id)

    const fileName = await getKernelFileName() // mihomo-window/≥s-amd64.exe
    const alphaFileName = await getKernelFileName(true) // mihomo-windows-amd64-alpha.exe

    const alphaKernelFilePath = CoreWorkingDirectory + '/' + alphaFileName

    await ignoredError(Movefile, alphaKernelFilePath, alphaKernelFilePath + '.bak')

    if (suffix === '.zip') {
      await UnzipZIPFile(tmp, 'data')
      await Movefile('data/' + fileName, alphaKernelFilePath)
    } else {
      await UnzipGZFile(tmp, alphaKernelFilePath)
    }

    await Removefile(tmp)

    if (['darwin', 'linux'].includes(os)) {
      await ignoredError(Exec, 'chmod', ['+x', await AbsolutePath(alphaKernelFilePath)])
    }

    downloadSuccessful.value = true

    message.success('common.success')
  } catch (error: any) {
    console.log(error)
    message.error(error)
    downloadSuccessful.value = false
  }

  downloadLoading.value = false

  updateLocalVersion()
}

const getLocalVersion = async (showTips = false) => {
  localVersionLoading.value = true
  try {
    const fileName = await getKernelFileName(true)
    const kernelFilePath = CoreWorkingDirectory + '/' + fileName
    const res = await Exec(kernelFilePath, ['-v'])
    versionDetail.value = res.trim()
    return (
      res
        .trim()
        .match(/alpha\S+/)?.[0]
        .trim() || ''
    )
  } catch (error: any) {
    console.log(error)
    showTips && message.error(error)
  } finally {
    localVersionLoading.value = false
  }
  return ''
}

const getRemoteVersion = async (showTips = false) => {
  remoteVersionLoading.value = true
  try {
    const { body } = await HttpGet<string>(alphaVersionUrl)
    return body.trim()
  } catch (error: any) {
    console.log(error)
    showTips && message.error(error)
  } finally {
    remoteVersionLoading.value = false
  }
  return ''
}

const handleRestartKernel = async () => {
  if (!appSettings.app.kernel.running) return

  try {
    await kernelApiStore.restartKernel()

    downloadSuccessful.value = false

    message.success('common.success')
  } catch (error: any) {
    message.error(error)
  }
}

const handleGrantPermission = async () => {
  const fileName = await getKernelFileName(true)
  const kernelFilePath = CoreWorkingDirectory + '/' + fileName
  await GrantTUNPermission(kernelFilePath)
  message.success('common.success')
}

const initVersion = async () => {
  getLocalVersion()
    .then((v) => {
      localVersion.value = v
    })
    .catch((error: any) => {
      console.log(error)
    })

  getRemoteVersion()
    .then((versions) => {
      remoteVersion.value = versions
    })
    .catch((error: any) => {
      console.log(error)
    })
}

initVersion()
</script>

<template>
  <h3>
    Alpha
    <Button
      @click="handleGrantPermission"
      v-if="localVersion && envStore.env.os !== 'windows'"
      v-tips="'settings.kernel.grant'"
      type="text"
      size="small"
      icon="grant"
    />
    <Button
      @click="BrowserOpenURL('https://github.com/MetaCubeX/mihomo/releases/tag/Prerelease-Alpha')"
      icon="link"
      type="text"
      size="small"
    />
  </h3>
  <div class="tags">
    <Tag @click="updateLocalVersion(true)" style="cursor: pointer">
      {{ t('kernel.local') }}
      :
      {{ localVersionLoading ? 'Loading' : localVersion || t('kernel.notFound') }}
    </Tag>
    <Tag @click="updateRemoteVersion(true)" style="cursor: pointer">
      {{ t('kernel.remote') }}
      :
      {{ remoteVersionLoading ? 'Loading' : remoteVersion }}
    </Tag>
    <Button
      v-show="!localVersionLoading && !remoteVersionLoading && needUpdate"
      @click="downloadCore"
      :loading="downloadLoading"
      size="small"
      type="primary"
    >
      {{ t('kernel.update') }} : {{ remoteVersion }}
    </Button>
    <Button
      v-show="!localVersionLoading && !remoteVersionLoading && needRestart"
      @click="handleRestartKernel"
      :loading="kernelApiStore.loading"
      size="small"
      type="primary"
    >
      {{ t('kernel.restart') }}
    </Button>
  </div>
  <div class="detail">
    {{ versionDetail }}
  </div>
</template>

<style lang="less" scoped>
.detail {
  font-size: 12px;
  padding: 8px 4px;
  word-wrap: break-word;
  word-break: break-all;
}
.tags {
  display: flex;
  align-items: center;
  min-height: 34px;
}
</style>
