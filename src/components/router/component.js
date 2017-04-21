'use strict'
const history = require('../../history')
const nestedRoutePlaceholder = require('../nested-route-placeholder')
const assert = require('assert')

/**
 * Inserts the routes all of the routes into the components
 */
function _registerRoutes (router, routes, parentPath) {
  parentPath = parentPath || ''

  for (let i = 0; i < routes.length; i++) {
    let route = routes[i]
    let currentPath = parentPath + route.path

    assert(route.path && route.component, 'path and component must be provided in a route')

    router.insert({
      path: currentPath,
      component: route.component,
      parentPath: parentPath.length ? parentPath : null
    })

    if (route.nestedRoutes) {
      _registerRoutes(router, route.nestedRoutes, currentPath)
    }
  }
}

function _handleRouteChange (self) {
  const router = self._router

  return function (event) {
    let routePath = event.path
    let routeData = router.lookup(routePath)
    let parentPath = routeData.parentPath

    // path of the component that is going to be rendered
    let componentPath = routePath
    let component = routeData.component
    let componentInput = {}

    let componentStack = self._componentStack

    if (component) {
      let existingComponent

      // if the component already exists in the component stack, find it and exit
      for (var i = 0; i < componentStack.length; i++) {
        if (routePath === componentStack[i].path) {
          existingComponent = componentStack[i].component
          componentStack = componentStack.slice(0, i + 1)
          break
        }
      }

      // while there is a parentPath, get the component and render the current
      // component within the parent. Continue until no more parents or
      // existing parent is found
      while (parentPath && !existingComponent) {
        let parentRouteData = router.lookup(parentPath)
        let parentComponent = parentRouteData.component

        // copy current component and input into new variable so that
        // it can be used by new renderBody function for parent
        let childComponent = component
        let childComponentInput = componentInput
        let childComponentPath = componentPath

        let parentComponentInput = {
          renderBody: function (out) {
            nestedRoutePlaceholder.render({
              path: childComponentPath,
              component: childComponent,
              componentInput: childComponentInput,
              router: self
            }, out)
          }
        }

        // current component becomes the parent component
        component = parentComponent
        componentInput = parentComponentInput
        componentPath = parentPath

        let stackIndex = componentStack.length - 1

        // if no existing component found and component has a parent route,
        // traverse backwards, then slice off the remaining parts if
        // an existing component is found
        while (stackIndex >= 0) {
          let existingComponentData = componentStack[stackIndex]
          let path = existingComponentData.path

          if (path === routePath) {
            componentInput = {}
            existingComponent = existingComponentData.component
            break
          } else if (path === parentPath) {
            existingComponent = existingComponentData.component
            break
          }

          stackIndex--
        }

        // component was found, break out
        if (existingComponent) {
          let stoppingPoint = stackIndex + 1
          while (componentStack.length > stoppingPoint) {
            componentStack.pop()
          }
          break
        }

        parentPath = parentRouteData.parentPath
      }

      if (existingComponent) {
        existingComponent.input = componentInput
        existingComponent.update()
      } else {
        //var render = component.renderSync(componentInput)
        //render.replaceChildrenOf(self.getEl('mount-point'))

        self._renderBody = function (out) {
          component.render(componentInput, out)
        }

        if (self.update) {
          self.update()
        }

        // TODO: handle renderers that are not components
        try {
          self._componentStack = [{
            path: componentPath,
            component: render.getComponent()
          }]
        } catch (err) {
          console.warn('No component to retrieve, not pushing to stack')
        }
      }

      self._componentStack = self._componentStack.concat(self._componentBuffer.reverse())

      self._componentBuffer = []
      self.currentRoute = routePath

      if (self.emit) {
        self.emit('update')
      }
    }
  }
}

module.exports = {
  onCreate: function (input) {
    const self = this
    const provider = input.routeProvider

    console.log(provider, provider.getRoutes)

    console.log(typeof provider.getRoutes)
    if (!provider || typeof provider.getRoutes !== 'function') {
      console.log('provider function must be supplied')
    }

    const routes = provider.getRoutes()
    console.log(routes)

    if (!routes) {
      throw new Error('"routes" param must be provided')
    } else if (routes && routes.length === 0) {
      throw new Error('"routes" list cannot be empty')
    }

    const router = self._router = input.router || history.getRouter()

    // maintain a stack of components that are currently rendered
    self._componentStack = []
    self._componentBuffer = []
    const initialRoute = self.initialRoute = input.initialRoute

    // traverse the given routes and create the router
    _registerRoutes(router, routes, undefined)

    self.changeHandler = _handleRouteChange(self)

    let routeData = router.lookup(initialRoute)
    if (routeData) {
      self.changeHandler(routeData)
    }
  },

  onMount: function () {
    const self = this
    const initialRoute = self.input && self.input.initialRoute
    const input = self.input
    let router = self._router

    return
    if (router.lookup) {
      router = self._router = input.router || history.getRouter()
      let provider = input.routeProvider
      let routes = provider.getRoutes()
      _registerRoutes(router, routes, undefined)
    }

    let changeHandler = self.changeHandler || _handleRouteChange(self)

    history.on('change-route', changeHandler)

    self.on('destroy', () => {
      history.removeListener('change-route', changeHandler)
    })

    if (false && initialRoute) {
      try {
        history.push(initialRoute)
        self.currentRoute = initialRoute
      } catch (err) {
        throw new Error('Unable to push initial route ' + err)
      }
    }
  },

  onDestroy: function () {
    // clear history?
  },

  register: function (path, component) {
    let currentComponent = this._componentStack[this._componentStack.length - 1]
    if (!currentComponent || currentComponent.path !== path) {
      this._componentBuffer.push({
        path: path,
        component: component
      })
    }
  }
}
