using System;
using System.Diagnostics;
using System.Threading.Tasks;

using Core.KenticoKontent.Models.Management.Elements;
using Core.KenticoKontent.Models.Management.Items;
using Core.KenticoKontent.Models.Management.References;
using Core.KenticoKontent.Services;

using Functions.Models;

using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Extensions.Logging;

namespace Functions
{
    public class KontentSync : BaseFunction
    {
        private readonly IKontentRepository kontentRepository;
        private readonly IKontentApiTracker kontentApiTracker;

        public KontentSync(
            ILogger<KontentSync> logger,
            IKontentRepository kontentRepository,
            IKontentApiTracker kontentApiTracker
            ) : base(logger)
        {
            this.kontentRepository = kontentRepository;
            this.kontentApiTracker = kontentApiTracker;
        }

        [FunctionName(nameof(KontentSync))]
        public async Task<IActionResult> Run(
            [HttpTrigger(
                "post",
                Route = Routes.KontentSync
            )] SyncRequest syncRequest,
            string languageCodename,
            string typeId,
            string elementId
            )
        {
            try
            {
                var stopwatch = new Stopwatch();

                stopwatch.Start();

                var initialApiCalls = kontentApiTracker.ApiCalls;

                var languageReference = new CodenameReference(languageCodename ?? "");
                var newTypeReference = new IdReference(typeId ?? "");
                var newElementReference = new IdReference(elementId ?? "");

                var newItemReference = new ExternalIdReference(kontentRepository.GetExternalId());

                var newItem = await kontentRepository.UpsertContentItem(new ContentItem
                {
                    ExternalId = newItemReference.Value,
                    TypeReference = newTypeReference,
                    Name = syncRequest.Name
                });

                var newVariant = await kontentRepository.UpsertLanguageVariant(new UpsertLanguageVariantParameters
                {
                    LanguageReference = languageReference,
                    Variant = new LanguageVariant
                    {
                        ItemReference = newItemReference,
                        Elements = new AbstractElement[]
                        {
                            new RichTextElement
                            {
                                Element = newElementReference,
                                Value = syncRequest.RichTextValue
                            }
                        }
                    }
                });

                stopwatch.Stop();

                return LogOkObject(new
                {
                    TotalApiCalls = kontentApiTracker.ApiCalls - initialApiCalls,
                    TotalMilliseconds = stopwatch.ElapsedMilliseconds,
                    NewItem = newItem,
                    Language = new { id = newVariant.Language!.Value }
                });
            }
            catch (Exception ex)
            {
                return LogException(ex);
            }
        }
    }
}