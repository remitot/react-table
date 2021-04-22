import React from 'react'
import ReactDOM from 'react-dom'

import {
  actions,
  defaultColumn,
  makePropGetter,
  useGetLatest,
  ensurePluginOrder,
  useMountedLayoutEffect,
} from '../publicUtils'

import { getFirstDefined, passiveEventSupported } from '../utils'

// Default Column
defaultColumn.canResize = true

// Actions
actions.columnStartResizing = 'columnStartResizing'
actions.columnResizing = 'columnResizing'
actions.columnDoneResizing = 'columnDoneResizing'
actions.columnEndResizing = 'columnEndResizing'
actions.resetResize = 'resetResize'

export const useResizeColumns = hooks => {
  hooks.getResizerProps = [defaultGetResizerProps]
  hooks.getTableProps.push(getTableProps)
  hooks.getHeaderProps.push({
    style: {
      position: 'relative',
    },
  })
  hooks.stateReducers.push(reducer)
  hooks.useInstance.push(useInstance)
  hooks.useInstanceBeforeDimensions.push(useInstanceBeforeDimensions)
}

const getTableProps = (props, { instance }) => {
  const { state } = instance
  if (state?.columnResizing?.isResizingColumn != null) {
    return [
      props,
      {
        style: {
          ...props.style,
          MozUserSelect: 'none',
          WebkitUserSelect: 'none',
          msUserSelect: 'none',
          userSelect: 'none',
        },
      },
    ]
  } else {
    return [
      props,
      {
        style: {
          ...props.style,
        },
      },
    ]
  }
}

const Preview = React.forwardRef(({ id, component }, ref) => {
  if (component) {
    return ReactDOM.createPortal(
      React.createElement(component, {
        id: id,
        ref: ref,
        style: {
          display: 'none',
          position: 'absolute'
        },
      }),
      document.body
    )
  } else {
    return ReactDOM.createPortal(
      <div
        id={id}
        ref={ref}
        style={{
          display: 'none',
          position: 'absolute',
          height: '100vh',
          width: '2px',
          boxSizing: 'border-box',
          borderLeft: '1px solid black',
        }}
      />,
      document.body
    )
  }
})

const defaultGetResizerProps = (props, { instance, header }) => {
  const { dispatch, preview } = instance
  const previewRef = React.createRef()

  const onResizeStart = (e, header) => {
    previewRef.current.style.display = 'block'
    previewRef.current.style.top = `${e.target.getBoundingClientRect().top}px`

    let isTouchEvent = false
    if (e.type === 'touchstart') {
      // lets not respond to multiple touches (e.g. 2 or 3 fingers)
      if (e.touches && e.touches.length > 1) {
        return
      }
      isTouchEvent = true
    }

    const headersToResize = getLeafHeaders(header)
    const headerIdWidths = headersToResize.map(d => [d.id, d.totalWidth])
    const clientX = isTouchEvent ? Math.round(e.touches[0].clientX) : e.clientX
    previewRef.current.style.left = `${clientX}px`

    const dispatchMoveEnd = clientXPos =>
      dispatch({ type: actions.columnEndResizing, clientX: clientXPos })

    const mouseMoveHandler = previewRef => {
      const ref = previewRef.current
      return e => {
        ref.style.left = `${e.clientX}px`
      }
    }

    const mouseEndHandler = previewRef => {
      const ref = previewRef.current
      return e => {
        ref.style.display = 'none'
        document.removeEventListener(
          'mousemove',
          handlersAndEvents.mouse.moveHandler
        )
        document.removeEventListener(
          'mouseup',
          handlersAndEvents.mouse.upHandler
        )
        document.removeEventListener(
          'mouseleave',
          handlersAndEvents.mouse.leaveHandler
        )
        dispatchMoveEnd(e.clientX)
      }
    }

    const touchMoveHandler = previewRef => {
      const ref = previewRef.current
      return e => {
        if (e.cancelable) {
          e.preventDefault()
          e.stopPropagation()
        }
        ref.style.left = `${e.touches[0].clientX}px`
        return false
      }
    }

    const touchEndHandler = previewRef => {
      const ref = previewRef.current
      return e => {
        ref.style.display = 'none'
        document.removeEventListener(
          handlersAndEvents.touch.moveEvent,
          handlersAndEvents.touch.moveHandler
        )
        document.removeEventListener(
          handlersAndEvents.touch.upEvent,
          handlersAndEvents.touch.upHandler
        )
        document.removeEventListener(
          handlersAndEvents.touch.leaveEvent,
          handlersAndEvents.touch.leaveHandler
        )
        dispatchMoveEnd((e.touches[0] || e.changedTouches[0]).clientX)
      }
    }

    const handlersAndEvents = {
      mouse: {
        moveEvent: 'mousemove',
        moveHandler: mouseMoveHandler(previewRef),
        upEvent: 'mouseup',
        upHandler: mouseEndHandler(previewRef),
        leaveEvent: 'mouseleave',
        leaveHandler: mouseEndHandler(previewRef),
      },
      touch: {
        moveEvent: 'touchmove',
        moveHandler: touchMoveHandler(previewRef),
        upEvent: 'touchend',
        upHandler: touchEndHandler(previewRef),
        leaveEvent: 'touchcancel',
        leaveHandler: touchEndHandler(previewRef),
      },
    }

    const events = isTouchEvent
      ? handlersAndEvents.touch
      : handlersAndEvents.mouse
    const passiveIfSupported = passiveEventSupported()
      ? { passive: false }
      : false
    document.addEventListener(
      events.moveEvent,
      events.moveHandler,
      passiveIfSupported
    )
    document.addEventListener(
      events.upEvent,
      events.upHandler,
      passiveIfSupported
    )
    document.addEventListener(
      events.leaveEvent,
      events.leaveHandler,
      passiveIfSupported
    )
    dispatch({
      type: actions.columnStartResizing,
      columnId: header.id,
      columnWidth: header.totalWidth,
      headerIdWidths,
      clientX,
    })
  }

  return [
    props,
    {
      onMouseDown: e => e.persist() || onResizeStart(e, header),
      onTouchStart: e => e.persist() || onResizeStart(e, header),
      style: {
        cursor: 'col-resize',
      },
      draggable: false,
      role: 'separator',
      children: React.createElement(Preview, {
        id: header.id + '_resizer_preview',
        ref: previewRef,
        component: preview,
      }),
    },
  ]
}

useResizeColumns.pluginName = 'useResizeColumns'

function reducer(state, action) {
  if (action.type === actions.init) {
    return {
      columnResizing: {
        columnWidths: {},
      },
      ...state,
    }
  }

  if (action.type === actions.resetResize) {
    return {
      ...state,
      columnResizing: {
        columnWidths: {},
      },
    }
  }

  if (action.type === actions.columnStartResizing) {
    const { clientX, columnId, columnWidth, headerIdWidths } = action

    return {
      ...state,
      columnResizing: {
        ...state.columnResizing,
        startX: clientX,
        headerIdWidths,
        columnWidth,
        isResizingColumn: columnId,
      },
    }
  }

  if (action.type === actions.columnResizing) {
    const { clientX } = action
    const { startX, columnWidth, headerIdWidths = [] } = state.columnResizing

    const deltaX = clientX - startX
    const percentageDeltaX = deltaX / columnWidth

    const newColumnWidths = {}

    headerIdWidths.forEach(([headerId, headerWidth]) => {
      newColumnWidths[headerId] = Math.max(
        headerWidth + headerWidth * percentageDeltaX,
        0
      )
    })

    return {
      ...state,
      columnResizing: {
        ...state.columnResizing,
        columnWidths: {
          ...state.columnResizing.columnWidths,
          ...newColumnWidths,
        },
      },
    }
  }

  if (action.type === actions.columnDoneResizing) {
    return {
      ...state,
      columnResizing: {
        ...state.columnResizing,
        startX: null,
        isResizingColumn: null,
      },
    }
  }

  if (action.type === actions.columnEndResizing) {
    const { clientX } = action
    const { startX, columnWidth, headerIdWidths = [] } = state.columnResizing

    const deltaX = clientX - startX
    const percentageDeltaX = deltaX / columnWidth

    const newColumnWidths = {}

    headerIdWidths.forEach(([headerId, headerWidth]) => {
      newColumnWidths[headerId] = Math.max(
        headerWidth + headerWidth * percentageDeltaX,
        0
      )
    })

    return {
      ...state,
      columnResizing: {
        ...state.columnResizing,
        columnWidths: {
          ...state.columnResizing.columnWidths,
          ...newColumnWidths,
        },
        startX: null,
        isResizingColumn: null,
      },
    }
  }
}

const useInstanceBeforeDimensions = instance => {
  const { plugins } = instance
  
  ensurePluginOrder(plugins, ['useFlexLayout'], 'useResizeColumns')

  const {
    flatHeaders,
    disableResizing,
    getHooks,
    state: { columnResizing },
  } = instance

  const getInstance = useGetLatest(instance)

  flatHeaders.forEach(header => {
    const canResize = getFirstDefined(
      header.disableResizing === true ? false : undefined,
      disableResizing === true ? false : undefined,
      true
    )

    header.canResize = canResize
    header.width =
      columnResizing.columnWidths[header.id] ||
      header.originalWidth ||
      header.width
    header.isResizing = columnResizing.isResizingColumn === header.id

    if (canResize) {
      header.getResizerProps = makePropGetter(getHooks().getResizerProps, {
        instance: getInstance(),
        header,
      })
    }
  })
}

function useInstance(instance) {
  const { dispatch, autoResetResize = true, columns } = instance

  const getAutoResetResize = useGetLatest(autoResetResize)
  useMountedLayoutEffect(() => {
    if (getAutoResetResize()) {
      dispatch({ type: actions.resetResize })
    }
  }, [columns])

  const resetResizing = React.useCallback(
    () => dispatch({ type: actions.resetResize }),
    [dispatch]
  )

  Object.assign(instance, {
    resetResizing,
  })
}

function getLeafHeaders(header) {
  const leafHeaders = []
  const recurseHeader = header => {
    if (header.columns && header.columns.length) {
      header.columns.map(recurseHeader)
    }
    leafHeaders.push(header)
  }
  recurseHeader(header)
  return leafHeaders
}
