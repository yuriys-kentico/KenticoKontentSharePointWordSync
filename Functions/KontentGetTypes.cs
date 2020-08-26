using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

using Core.KenticoKontent.Models.Management.References;
using Core.KenticoKontent.Models.Management.Types;
using Core.KenticoKontent.Services;

using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Extensions.Logging;

namespace Functions
{
    public class KontentGetTypes : BaseFunction
    {
        private readonly IKontentRepository kontentRepository;

        public KontentGetTypes(
            ILogger<KontentSync> logger,
            IKontentRepository kontentRepository
            ) : base(logger)
        {
            this.kontentRepository = kontentRepository;
        }

        [FunctionName(nameof(KontentGetTypes))]
        public async Task<IActionResult> Run(
            [HttpTrigger(
                "get",
                Route = Routes.KontentGetTypes
            )] string body
            )
        {
            try
            {
                var allTypes = await kontentRepository.ListContentTypes();

                foreach (var type in allTypes)
                {
                    if (type.Elements == null)
                    {
                        throw new NotImplementedException("Item type does not have elements.");
                    }

                    var newTypeElements = new List<ElementType>(type.Elements);

                    foreach (var typeElement in type.Elements)
                    {
                        if (typeElement.Snippet != null)
                        {
                            var itemTypeSnippet = await kontentRepository.RetrieveContentTypeSnippet(typeElement.Snippet);

                            if (itemTypeSnippet.Elements == null)
                            {
                                throw new NotImplementedException("Item type snippet does not have elements.");
                            }

                            foreach (var typeSnippetElement in itemTypeSnippet.Elements)
                            {
                                newTypeElements.Add(typeSnippetElement);
                            }
                        }
                    }

                    var supportingElements = new[] { "snippet", "guidelines" };

                    type.Elements = newTypeElements.Where(element => !supportingElements.Contains(element.Type)).ToList();
                }

                return LogOkObject(new
                {
                    AllTypes = allTypes
                });
            }
            catch (Exception ex)
            {
                return LogException(ex);
            }
        }
    }
}