import { useEffect } from 'react'
import type { Transition } from 'history'
import { appHistory } from '../lib/history'

export function useUnsavedChangesPrompt(shouldPrompt: boolean, message: string) {

  useEffect(() => {
    if (!shouldPrompt) {
      return
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = message
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [message, shouldPrompt])

  useEffect(() => {
    if (!shouldPrompt) {
      return
    }

    const unblock = appHistory.block((tx: Transition) => {
      const confirmLeave = window.confirm(message)
      if (confirmLeave) {
        unblock()
        tx.retry()
      }
    })

    return () => {
      unblock()
    }
  }, [message, shouldPrompt])
}
