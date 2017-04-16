module.exports = {
  onMount: function () {
    let component = this.state.component
    let router = this.state.router
    let path = this.state.path
    let componentInput = this.state.componentInput

    let render = component.renderSync(componentInput)
    render.appendTo(this.getEl())

    try {
      router.register(path, render.getComponent())
    } catch (err) {
    }
  },

  onInput: function (input) {
    this.state = {
      path: input.path,
      component: input.component,
      componentInput: input.componentInput,
      router: input.router
    }
  }
}
