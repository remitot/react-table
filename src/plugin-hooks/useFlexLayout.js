export function useFlexLayout(hooks) {
  hooks.getTableBodyProps.push(getTableBodyProps)
  hooks.getTableProps.push(getTableProps)
  hooks.getRowProps.push(getRowStyles)
  hooks.getHeaderGroupProps.push(getRowStyles)
  hooks.getFooterGroupProps.push(getRowStyles)
  hooks.getHeaderProps.push(getHeaderProps)
  hooks.getCellProps.push(getCellProps)
  hooks.getFooterProps.push(getFooterProps)
}

useFlexLayout.pluginName = 'useFlexLayout'


const getTableProps = (props, { instance }) => [
  props,
  {
    style: {
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      minWidth: `${instance.totalColumnsWidth}px`,
    },
  },
]

const getTableBodyProps = props => [
  props,
  {
    style: {
      boxSizing: 'border-box',
    },
  },
]

const getRowStyles = (props, { instance }) => [
  props,
  {
    style: {
      boxSizing: 'border-box',
      display: 'flex',
      flex: '1 0 auto',
      minWidth: `${instance.totalColumnsMinWidth}px`,
    },
  },
]

const getHeaderProps = (props, { column }) => {
    return [
      props,
      {
        style: {
          display: 'inline-flex',
          boxSizing: 'border-box',
          width: `${column.totalWidth}px`,
        },
      },
    ]
}

const getCellProps = (props, { cell }) => {

    return [
      props,
      {
        style: {
          display: 'inline-flex',
          boxSizing: 'border-box',
          width: `${cell.column.totalWidth}px`,
        },
      },
    ]
}

const getFooterProps = (props, { column }) => [
  props,
  {
    style: {
      boxSizing: 'border-box',
      flex: column.totalFlexWidth
        ? `${column.totalFlexWidth} 0 auto`
        : undefined,
      minWidth: `${column.totalMinWidth}px`,
      width: `${column.totalWidth}px`,
    },
  },
]
