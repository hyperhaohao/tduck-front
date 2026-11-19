/**
 * 读取 fetch 返回的 SSE 流，按空行分帧并回调 JSON 事件。
 * 兼容 CRLF、data: 后有无空格、心跳注释和坏帧。
 */
export async function readSseStream(body, onEvent) {
  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let invalidFrames = 0

  const dispatch = (frame) => {
    const data = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n')
    if (!data) return
    let event
    try {
      event = JSON.parse(data)
    } catch (e) {
      invalidFrames += 1
      return
    }
    onEvent(event)
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let match
    while ((match = /\r?\n\r?\n/.exec(buffer))) {
      const frame = buffer.slice(0, match.index)
      buffer = buffer.slice(match.index + match[0].length)
      dispatch(frame)
    }
  }
  buffer += decoder.decode()
  if (buffer.trim()) dispatch(buffer)
  return { invalidFrames }
}
