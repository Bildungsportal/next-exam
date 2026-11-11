import Swal from 'sweetalert2'

const queue = []
let busy = false

async function processQueue() {
    if (busy || queue.length === 0) return
    busy = true
    const { opts, resolve } = queue.shift()
    const result = await Swal.fire(opts)
    resolve(result)
    busy = false
    await processQueue()
}

export function swalQueued(opts) {
    return new Promise(resolve => {
        queue.push({ opts, resolve })
        processQueue()
    })
}
