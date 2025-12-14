import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'

import { createDebugLogger, getFilePathFromUrl } from '@/utils/logger'

const logger = createDebugLogger(getFilePathFromUrl(import.meta.url))

interface RouterContext {}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => {
    logger.debug('RootComponent', 'Root route component rendered')
    return (
      <>
        <Outlet />
        {/* <TanStackDevtools
          config={{
            position: 'top-left',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        /> */}
      </>
    )
  },
})
