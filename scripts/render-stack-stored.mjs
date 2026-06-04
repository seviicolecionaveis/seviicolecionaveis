import { render } from '@react-email/components'
import React from 'react'
import { template } from '../src/lib/email-templates/stack-order-stored.tsx'
import fs from 'fs'

const html = await render(React.createElement(template.component, template.previewData))
fs.writeFileSync('/mnt/documents/email-pilha-pedido-armazenado.html', html)
const subject = typeof template.subject === 'function' ? template.subject(template.previewData) : template.subject
console.log('SUBJECT:', subject)
