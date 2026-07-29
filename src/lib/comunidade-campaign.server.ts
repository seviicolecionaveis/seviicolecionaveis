import React from 'react'
import { render } from '@react-email/render'
import { template as comunidadeLaunchTemplate } from './email-templates/comunidade-launch'

/** Renders the "Comunidade Sevii" announcement template to HTML for a Brevo campaign. */
export async function renderComunidadeCampaignHtml() {
  const element = React.createElement(comunidadeLaunchTemplate.component, {})
  return await render(element)
}
