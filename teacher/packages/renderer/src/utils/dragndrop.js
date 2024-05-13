import { v4 as uuidv4 } from 'uuid'

function handleDragEndItem() {
    this.movingItem = this.studentwidgets[this.originalIndex];
    this.futureItem = this.studentwidgets[this.futureIndex];
    if (this.movingItem && this.futureItem) {
        this.studentwidgets[this.futureIndex] = this.movingItem;
        this.studentwidgets[this.originalIndex] = this.futureItem;
    }
    document.querySelectorAll('.studentwidget').forEach((el) => (el.style.backgroundColor = 'transparent'));
}
function handleMoveItem(event) {
    document.querySelectorAll('.studentwidget').forEach((el) => (el.style.backgroundColor = 'transparent'));
    const { index, futureIndex } = event.draggedContext;
    this.originalIndex = index;
    this.futureIndex = futureIndex;
    if (this.studentwidgets[this.futureIndex]) { event.to.children[this.futureIndex].style.backgroundColor = 'rgba(13, 202, 240, 0.15)'; }
    return false; // disable sort
}
function sortStudentWidgets() {
    this.studentwidgets.sort((a, b) => {
        let one = a.clientname
        let two = b.clientname
        if ( !one) { one = "zzzz"}  // noone is named zzzz so empty widget comes last
        if ( !two) { two = "zzzz"}
        if (one > two) {return 1; }
        if (one < two) {return -1;}
        return 0;
    })
}

class EmptyWidget {
    constructor() {
        this.clientname = false
        this.token = uuidv4()
        this.imageurl="user-black.svg"    
    }
}



// create 10 empty widgets for whole class (should be sufficient)
function initializeStudentwidgets(){
    let widgets = []
    for (let i = 0; i<30; i++ ){
        widgets.push(new EmptyWidget)
    }
    this.studentwidgets = widgets;
}

export { handleDragEndItem, handleMoveItem, sortStudentWidgets, initializeStudentwidgets}