function SectionTitle({ icon: Icon, children, as: Wrapper = 'p', className = '', ...rest }) {
  return (
    <Wrapper
      className={`section-title ${className}`.trim()}
      style={{ marginLeft: 0, display: 'flex', alignItems: 'center', gap: 6 }}
      {...rest}
    >
      <Icon size={14} />
      {children}
    </Wrapper>
  )
}

export default SectionTitle
