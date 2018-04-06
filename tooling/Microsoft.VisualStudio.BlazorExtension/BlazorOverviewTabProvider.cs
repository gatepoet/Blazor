using Microsoft.VisualStudio.ScriptedHost;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using Microsoft.VisualStudio.TabDesigner;
using System;
using System.Collections.Generic;
using System.ComponentModel.Composition;
using System.ComponentModel.Design;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;

namespace Microsoft.VisualStudio.BlazorExtension
{
    [Export(typeof(IProjectDesignerTabProvider))]
    [ExportMetadata("NameResourceId", "Hello")]
    [ExportMetadata("DescriptionResourceId", "This is a test tab")]
    [ExportMetadata("Id", "Microsoft.VisualStudio.ApplicationCapabilities.Overview")]
    [ExportMetadata("PackageGuid", BlazorPackage.PackageGuidString)]
    [ExportMetadata("Order", 10001)]
    [ExportMetadata("Specialization", 37)]
    [ExportMetadata("AppliesTo", "Blazor")]
    [ExportMetadata("DesignerId", "Microsoft.VisualStudio.ApplicationCapabilities")]
    public class BlazorOverviewTabProvider : IProjectDesignerTabProvider
    {
        private ScriptedControl scriptedControl;

        public async Task<object> CreateViewAsync(IVsHierarchy project, Microsoft.VisualStudio.Shell.IAsyncServiceProvider asyncServiceProvider, CancellationToken cancellationToken)
        {
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);

            OleMenuCommandService focusCommandService = await asyncServiceProvider.GetServiceAsync(typeof(IMenuCommandService)) as OleMenuCommandService;

            // Get path of manifest.json of daytona plugin
            string daytonaHostDirectory = Path.Combine(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location));
            string manifestPath = Path.Combine(daytonaHostDirectory, "overview_manifest.json").Replace("\\\\", "\\");

            // Create ScriptedControl
            this.scriptedControl = new ScriptedControl(manifestPath, daytonaHostDirectory, focusCommandService, focusCommandService);

            // Get WPF element from ScriptedControl
            object scriptedControlElement;
            this.scriptedControl.GetFrameworkElement(out scriptedControlElement);
            var scriptedControlUIElement = scriptedControlElement as UIElement;

            return scriptedControlUIElement;
        }

        public System.Threading.Tasks.Task OnDeactivatedAsync(CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public System.Threading.Tasks.Task OnActivatedAsync(CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public void Dispose()
        {
            throw new NotImplementedException();
        }
    }
}
