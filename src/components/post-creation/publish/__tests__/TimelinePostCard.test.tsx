import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TimelinePostCard } from '../TimelinePostCard'

describe('TimelinePostCard', () => {
  it('places the status badge in the upper-right corner of the card', () => {
    const { container } = render(
      <TimelinePostCard
        platform="Facebook"
        isConnected
        statusLabel="published"
        statusClassName="bg-green-600 text-white"
        title="Breakfast offer"
        time="fre. 19. jun. 11.57"
      >
        <div>metrics</div>
      </TimelinePostCard>
    )

    const card = container.firstElementChild as HTMLElement
    expect(card).toHaveClass('relative')

    const badge = screen.getByText('published')
    expect(badge).toHaveClass('absolute')
    expect(badge).toHaveClass('top-2')
    expect(badge).toHaveClass('right-2')

    expect(screen.getByText('Facebook')).toBeInTheDocument()
    expect(screen.getByText('Breakfast offer')).toBeInTheDocument()
    expect(screen.getByText('metrics')).toBeInTheDocument()
  })
})