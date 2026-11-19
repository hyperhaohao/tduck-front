import api from '@/api/index'
import { getToken } from '@/utils/auth'
import { readSseStream } from '@/utils/sseStream'

export const getAiStatus = () => api({ url: '/ai/status', method: 'get', silent: true })

export const testAiConnection = () => api({ url: '/ai/test-connection', method: 'get', silent: true })

/**
 * 新版流式接口。使用 POST + fetch，token 放在请求头，支持长历史与中止。
 */
export async function streamFormChat(payload, { signal, onEvent } = {}) {
  const base = process.env.VUE_APP_API_ROOT || ''
  const response = await fetch(base + '/ai/gen-form-chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      token: getToken()
    },
    body: JSON.stringify(payload),
    signal,
    cache: 'no-store'
  })

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/event-stream')) {
    let message = 'AI 请求失败'
    let code = 'AI_HTTP_ERROR'
    let retryable = false
    try {
      const body = await response.json()
      if (body && body.msg) message = body.msg
      if (body && body.code) code = body.code
      retryable = [429, 500, 502, 503].includes(body && body.code)
    } catch (e) {
      // 非 JSON 错误响应，保留默认提示
    }
    const error = new Error(message)
    error.code = code
    error.retryable = retryable
    throw error
  }

  if (!response.body) {
    const error = new Error('当前浏览器不支持流式响应，请升级浏览器')
    error.code = 'AI_UNSUPPORTED_BROWSER'
    throw error
  }

  return readSseStream(response.body, onEvent)
}
