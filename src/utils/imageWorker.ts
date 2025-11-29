import { Payload } from 'payload'

interface WorkerPayload {
  id: string
  kind: 'featured' | 'inline'
  postId: string
  r2Key: string
}

interface WorkerResponse {
  id: string
  sizes: {
    [key: string]: string
  }
}

export const triggerImageWorker = async (
  data: WorkerPayload,
): Promise<WorkerResponse | null> => {
  const workerUrl = process.env.IMAGE_WORKER_URL
  const workerSecret = process.env.IMAGE_WORKER_SECRET

  if (!workerUrl || !workerSecret) {
    console.warn('IMAGE_WORKER_URL or IMAGE_WORKER_SECRET not set')
    return null
  }

  console.log('Triggering image worker for:', data)

  try {
    const response = await fetch(`${workerUrl}/generate-sizes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Image-Secret': workerSecret,
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Worker error: ${response.status} ${errorText}`)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Error triggering image worker:', error)
    return null
  }
}

const getLargestSizeKey = (
  sizes: { [key: string]: string },
  postId: string,
  mediaId: string,
  kind: 'featured' | 'inline',
): string | null => {
  const priority = ['l', 'm', 's', 'xs']
  for (const size of priority) {
    if (sizes[size]) {
      if (kind === 'featured') {
        return `posts/${postId}/featured_${size}.webp`
      } else {
        return `posts/${postId}/inline_${mediaId}_${size}.webp`
      }
    }
  }
  return null
}

export const processPostImages = async (
  payload: Payload,
  post: any, // Using any for now to avoid complex type imports, can be refined
): Promise<void> => {
  console.log('Processing post images for:', post.id)
  const postId = post.id

  // 1. Process Featured Image
  if (post.featuredImage) {
    console.log('Found featured image:', post.featuredImage)
    let featuredImageId = post.featuredImage
    // Handle case where featuredImage is an object (populated)
    if (typeof featuredImageId === 'object' && featuredImageId?.id) {
      featuredImageId = featuredImageId.id
    }

    const media = await payload.findByID({
      collection: 'media',
      id: featuredImageId,
    })

    console.log('Fetched media:', media?.id, 'Processed:', media?.processed)

    if (media && !media.processed && media.filename) {
      console.log('Triggering worker for featured image...')
      const result = await triggerImageWorker({
        id: featuredImageId,
        kind: 'featured',
        postId: postId,
        r2Key: media.filename,
      })

      if (result) {
        const newFilename = getLargestSizeKey(
          result.sizes,
          postId,
          featuredImageId,
          'featured',
        )

        // Update Media record
        await payload.update({
          collection: 'media',
          id: featuredImageId,
          data: {
            processed: true,
            processedSizes: result.sizes,
            ...(newFilename && { filename: newFilename }),
          },
        })
      }
    }
  }

  // 2. Process Inline Images (Lexical)
  if (post.content && post.content.root) {
    const traverseNodes = async (nodes: any[]) => {
      for (const node of nodes) {
        if (node.type === 'upload' && node.value) {
          let mediaId = node.value
          if (typeof mediaId === 'object' && mediaId.id) {
            mediaId = mediaId.id
          }

          const media = await payload.findByID({
            collection: 'media',
            id: mediaId,
          })

          if (media && !media.processed && media.filename) {
            const result = await triggerImageWorker({
              id: mediaId,
              kind: 'inline',
              postId: postId,
              r2Key: media.filename,
            })

            if (result) {
              const newFilename = getLargestSizeKey(
                result.sizes,
                postId,
                mediaId,
                'inline',
              )

              await payload.update({
                collection: 'media',
                id: mediaId,
                data: {
                  processed: true,
                  processedSizes: result.sizes,
                  ...(newFilename && { filename: newFilename }),
                },
              })
            }
          }
        }

        if (node.children && Array.isArray(node.children)) {
          await traverseNodes(node.children)
        }
      }
    }

    if (post.content.root.children) {
      await traverseNodes(post.content.root.children)
    }
  }
}
