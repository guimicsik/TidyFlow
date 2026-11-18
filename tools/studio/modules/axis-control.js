export function createAxisControl(container, { title, min, max, value, type, sliderLabel, fieldLabel }) {
  const row = document.createElement('div');
  row.className = 'st-design-shadow-axis';
  const caption = document.createElement('span');
  caption.textContent = title;
  const range = document.createElement('input');
  range.type = 'range';
  range.min = min;
  range.max = max;
  range.step = 1;
  range.value = parseFloat(value) || 0;
  range.setAttribute('aria-label', sliderLabel);
  const field = document.createElement('input');
  field.type = type;
  if (type === 'number') field.step = 'any';
  field.value = value;
  field.className = 'st-design-shadow-number';
  field.setAttribute('aria-label', fieldLabel);
  row.append(caption, range, field);
  container.appendChild(row);
  return { range, field };
}
