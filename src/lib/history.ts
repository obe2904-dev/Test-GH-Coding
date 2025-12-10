import { createBrowserHistory, parsePath } from 'history'
import type { BrowserHistory } from 'history'
import type { History as RouterHistory, Action as RouterAction, Location as RouterLocation, To } from '@remix-run/router'

type ExtendedBrowserHistory = BrowserHistory & {
  createURL: RouterHistory['createURL']
  encodeLocation: RouterHistory['encodeLocation']
  listen: RouterHistory['listen']
}

const history = createBrowserHistory() as ExtendedBrowserHistory
const baseListen = history.listen.bind(history)

history.createURL = (to: To) => {
  const href = history.createHref(to)
  return new URL(href, window.location.origin)
}

history.encodeLocation = (to: To) => {
  const path = typeof to === 'string' ? parsePath(to) : to
  return {
    pathname: path.pathname ? encodeURI(path.pathname) : '',
    search: path.search ?? '',
    hash: path.hash ?? ''
  }
}

history.listen = (listener: Parameters<RouterHistory['listen']>[0]) => {
  return baseListen(({ action, location }) => {
    const delta = action === 'PUSH' ? 1 : action === 'REPLACE' ? 0 : null

    listener({
      action: action as RouterAction,
      location: location as RouterLocation,
      delta
    })
  })
}

export const appHistory = history
export const routerHistory = history as unknown as RouterHistory
